from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from backend import db
from backend.bot.alert_sender import send_alert, send_signal_alert
from engine.ohlcv_cache import fetch_candles, get_htf
from engine.rules import RULE_REGISTRY, evaluate_rule

log = logging.getLogger(__name__)


def _rule_name(rule) -> str:
    if isinstance(rule, str):
        return rule
    if isinstance(rule, dict):
        return str(rule.get("id") or rule.get("rule_id") or rule.get("key") or "")
    return ""


def _detect_direction(candles: list[dict]) -> str:
    if not candles:
        return "neutral"
    last = candles[-1]
    open_px = float(last.get("open", 0) or 0)
    close_px = float(last.get("close", 0) or 0)
    if close_px > open_px:
        return "long"
    if close_px < open_px:
        return "short"
    return "neutral"


def _grade(score: float) -> str:
    if score >= 90:
        return "S"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    if score >= 50:
        return "D"
    return "F"


def _make_trade_plan(candles, direction) -> dict:
    px = float(candles[-1]["close"])
    if direction == "long":
        sl = px * 0.99
        tp = px * 1.02
    else:
        sl = px * 1.01
        tp = px * 0.98
    rr = abs((tp - px) / max(abs(px - sl), 1e-9))
    return {"entry": px, "sl": sl, "tp": tp, "rr": rr}


async def evaluate_model(model: dict, candles: list, user_id: str) -> dict:
    """
    Evaluates a model against candles and returns a signal dict.
    Never raises.
    """
    try:
        timeframe = str(model.get("timeframe", "1h"))
        pair = str(model.get("pair", "BTCUSDT")).upper()
        htf_candles = await fetch_candles(pair, get_htf(timeframe), limit=120)
        direction = _detect_direction(candles)
        context = {
            "candles": candles,
            "htf_candles": htf_candles,
            "direction": direction,
            "pair": pair,
            "timeframe": timeframe,
            "user_id": user_id,
        }

        phase_rules = {
            1: model.get("phase1_rules", []),
            2: model.get("phase2_rules", []),
            3: model.get("phase3_rules", []),
            4: model.get("phase4_rules", []),
        }

        results = {}
        phase_reached = 0

        for phase_n in [1, 2, 3, 4]:
            rules = phase_rules.get(phase_n) or []
            if not rules:
                results[phase_n] = {"passed": True, "rules": []}
                phase_reached = phase_n
                continue

            phase_passed = True
            rule_results = []
            for rule in rules:
                rule_id = _rule_name(rule)
                if not rule_id:
                    continue
                rule_fn = RULE_REGISTRY.get(rule_id)
                if not rule_fn:
                    # Use the tolerant matcher for aliases/legacy IDs.
                    passed = evaluate_rule(rule_id, candles, **context)
                    rule_results.append({"rule": rule_id, "passed": bool(passed)})
                    if not passed:
                        phase_passed = False
                    continue
                try:
                    passed = bool(rule_fn(candles, **context))
                    rule_results.append({"rule": rule_id, "passed": passed})
                    if not passed:
                        phase_passed = False
                except Exception as exc:
                    log.error("Rule %s error: %s", rule_id, exc)
                    rule_results.append({"rule": rule_id, "passed": False, "error": str(exc)})
                    phase_passed = False

            results[phase_n] = {"passed": phase_passed, "rules": rule_results}
            if not phase_passed:
                break
            phase_reached = phase_n

        total_passed = sum(1 for phase in results.values() for item in phase.get("rules", []) if item.get("passed"))
        total_rules = sum(len(phase.get("rules", [])) for phase in results.values())
        quality_score = ((total_passed / total_rules) * 100) if total_rules > 0 else 0.0
        quality_score = min(100.0, quality_score + phase_reached * 3)
        quality_grade = _grade(quality_score)
        passed = phase_reached == 4 and results.get(4, {}).get("passed", False)

        signal = {
            "model_id": model.get("id"),
            "model_name": model.get("name"),
            "pair": pair,
            "timeframe": timeframe,
            "phase_reached": phase_reached,
            "passed": passed,
            "quality_score": round(quality_score, 1),
            "quality_grade": quality_grade,
            "grade": quality_grade,
            "direction": direction,
            "phase_results": results,
        }

        if phase_reached >= 2:
            signal_id = db.save_pending_signal(
                {
                    "user_id": user_id,
                    "section": "perps",
                    "model_id": model.get("id"),
                    "pair": pair,
                    "timeframe": timeframe,
                    "direction": direction,
                    "phase": phase_reached,
                    "score": quality_score,
                    "grade": quality_grade,
                    "status": "pending",
                    "meta": signal,
                }
            )
            signal["id"] = signal_id

        if passed:
            plan = _make_trade_plan(candles, direction)
            signal["plan"] = plan
            await send_signal_alert(user_id=user_id, signal=signal)
            await send_alert(user_id, f"*{pair}* {direction} | score={quality_score:.1f} grade={quality_grade}\nPlan: {plan}")

        return signal
    except Exception as exc:
        log.error("evaluate_model: %s", exc)
        return {"passed": False, "phase_reached": 0, "error": str(exc)}


async def run_model(model, user_id, context) -> dict:
    pair = str(model.get("pair", "BTCUSDT")).upper()
    timeframe = str(model.get("timeframe", "1h"))
    candles = await fetch_candles(pair, timeframe, limit=120)
    if not candles:
        return {"passed": False, "phase_reached": 0, "error": "no_candles", "pair": pair, "timeframe": timeframe}
    return await evaluate_model(model=model, candles=candles, user_id=user_id)


async def run_phase_scanner_for_user(user_id: str, context) -> None:
    for model in db.get_user_models(user_id, active_only=True):
        await run_model(model, user_id, context)


async def run_all_users_scanner(context, tier_filter=None) -> None:
    users = db._select_many("users")
    for user in users:
        if tier_filter and str(user.get("subscription_tier", "free")).lower() != str(tier_filter).lower():
            continue
        if db.get_user_models(user.get("id"), active_only=True):
            await run_phase_scanner_for_user(user.get("id"), context)


def _expire_old_signals() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    for row in db._select_many("pending_signals", status="pending"):
        created = row.get("created_at")
        if not created:
            continue
        try:
            dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
        except Exception:
            continue
        if dt < cutoff:
            db._update("pending_signals", {"status": "expired"}, id=row.get("id"))
