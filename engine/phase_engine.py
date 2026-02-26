from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend import db
from backend.bot.alert_sender import send_alert
from engine.ohlcv_cache import fetch_candles, get_htf
from engine.rules import evaluate_rule


async def run_phase_scanner_for_user(user_id: str, context) -> None:
    for model in db.get_user_models(user_id, active_only=True):
        await run_model(model, user_id, context)


async def run_model(model, user_id, context) -> None:
    pair = model.get("pair", "BTCUSDT")
    timeframe = model.get("timeframe", "1h")
    candles = await fetch_candles(pair, timeframe, limit=120)
    if not candles:
        return
    htf = await fetch_candles(pair, get_htf(timeframe), limit=120)
    p1 = evaluate_rule("rule_htf_bullish", candles, htf_candles=htf) or evaluate_rule("rule_htf_bearish", candles, htf_candles=htf)
    if not p1:
        return
    p2 = evaluate_rule("rule_bos_bullish", candles) or evaluate_rule("rule_bos_bearish", candles)
    if not p2:
        _save_signal(user_id, pair, "neutral", timeframe, "P2", 0, "D", model.get("name", "model"), candles, {})
        return
    p3 = evaluate_rule("rule_ote_zone", candles) and evaluate_rule("rule_killzone_active", candles)
    if not p3:
        _save_signal(user_id, pair, "neutral", timeframe, "P3", 0, "D", model.get("name", "model"), candles, {})
        return
    p4 = evaluate_rule("rule_candle_confirmation", candles) and evaluate_rule("rule_three_confluences", candles, htf_candles=htf)
    if not p4:
        _save_signal(user_id, pair, "neutral", timeframe, "P4", 0, "C", model.get("name", "model"), candles, {})
        return
    direction = "long" if candles[-1]["close"] >= candles[-1]["open"] else "short"
    score, grade = _calculate_quality({"p1": p1, "p2": p2, "p3": p3, "p4": p4})
    plan = _make_trade_plan(candles, direction)
    _save_signal(user_id, pair, direction, timeframe, "P4", score, grade, model.get("name", "model"), candles, plan)
    await send_alert(user_id, f"*{pair}* {direction} | score={score:.1f} grade={grade}\nPlan: {plan}")


async def run_all_users_scanner(context, tier_filter=None) -> None:
    users = db._select_many("users")
    for user in users:
        if tier_filter and str(user.get("subscription_tier", "free")).lower() != tier_filter.lower():
            continue
        if db.get_user_models(user.get("id"), active_only=True):
            await run_phase_scanner_for_user(user.get("id"), context)


def _calculate_quality(phase_results) -> tuple[float, str]:
    hits = sum(1 for v in phase_results.values() if v)
    score = min(100.0, hits / max(len(phase_results), 1) * 100.0)
    grade = "A" if score >= 85 else "B" if score >= 70 else "C" if score >= 50 else "D"
    return score, grade


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


def _normalise_pair_for_hl(pair) -> str:
    p = pair.upper()
    for s in ("USDT", "BUSD", "USD"):
        if p.endswith(s):
            return p[: -len(s)]
    return p


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


def _save_signal(user_id, pair, direction, timeframe, phase, score, grade, model_name, candles, plan) -> int:
    return db.save_pending_signal(
        {
            "user_id": user_id,
            "section": "perps",
            "pair": pair,
            "direction": direction,
            "timeframe": timeframe,
            "phase": phase,
            "score": score,
            "grade": grade,
            "model_name": model_name,
            "status": "pending",
            "meta": {"last_candle": candles[-1] if candles else {}, "plan": plan},
        }
    )
