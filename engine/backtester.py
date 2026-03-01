from __future__ import annotations

from datetime import datetime
import logging
from statistics import mean

from backend import db
from engine.ohlcv_cache import fetch_candles_range
from engine.phase_engine import _make_trade_plan
from engine.rules import evaluate_rule

log = logging.getLogger(__name__)


def _safe_float(value, default=0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


async def run_backtest(
    run_id,
    user_id,
    model,
    pair,
    timeframe,
    start_date,
    end_date,
    capital,
    *,
    slippage_bps: float = 0.0,
    commission_pct: float = 0.0,
) -> dict:
    db.update_backtest_run(run_id, {"status": "running", "error": None, "started_at": datetime.utcnow().isoformat()})
    try:
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
    except Exception as exc:
        msg = f"invalid_date_format:{exc}"
        db.update_backtest_run(run_id, {"status": "failed", "error": msg, "completed_at": datetime.utcnow().isoformat()})
        return {"status": "failed", "error": msg}
    if end_dt <= start_dt:
        msg = "invalid_date_range:end_date_must_be_after_start_date"
        db.update_backtest_run(run_id, {"status": "failed", "error": msg, "completed_at": datetime.utcnow().isoformat()})
        return {"status": "failed", "error": msg}

    try:
        start_ms = int(start_dt.timestamp() * 1000)
        end_ms = int(end_dt.timestamp() * 1000)
        candles = await fetch_candles_range(pair, timeframe, start_ms, end_ms)
    except Exception as exc:
        msg = f"ohlcv_provider_failure:{exc}"
        db.update_backtest_run(run_id, {"status": "failed", "error": msg, "completed_at": datetime.utcnow().isoformat()})
        return {"status": "failed", "error": msg}

    if len(candles) < 120:
        msg = f"insufficient_candles:need_120_have_{len(candles)}"
        log.warning("Backtest insufficient candles for %s %s between %s and %s: %s", pair, timeframe, start_date, end_date, len(candles))
        summary = {
            "status": "failed",
            "error": msg,
            "trades": 0,
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0.0,
            "total_pnl": 0.0,
            "pnl_summary": {"gross": 0.0, "net": 0.0},
            "max_drawdown": 0.0,
            "avg_rr": 0.0,
            "sharpe_ratio": 0.0,
            "profit_factor": 0.0,
            "equity_curve": [],
            "drawdown_curve": [],
        }
        db.update_backtest_run(run_id, {"status": "failed", "error": msg, "results_data": summary, "completed_at": datetime.utcnow().isoformat()})
        return summary

    try:
        balance = _safe_float(capital, 10000)
        peak = balance
        wins = 0
        losses = 0
        profits = []
        equity_curve = []
        drawdown_curve = []
        closed_trades = []

        for i in range(100, len(candles) - 1):
            window = candles[i - 100 : i]
            p1 = evaluate_rule("rule_htf_bullish", window) or evaluate_rule("rule_htf_bearish", window)
            p2 = evaluate_rule("rule_bos_bullish", window) or evaluate_rule("rule_bos_bearish", window)
            p3 = evaluate_rule("rule_ote_zone", window)
            p4 = evaluate_rule("rule_candle_confirmation", window)
            if not (p1 and p2 and p3 and p4):
                continue

            direction = "long" if window[-1]["close"] >= window[-1]["open"] else "short"
            plan = _make_trade_plan(window, direction)
            nxt = candles[i + 1]
            raw_entry = _safe_float(plan.get("entry"))
            raw_sl = _safe_float(plan.get("sl"))
            raw_tp = _safe_float(plan.get("tp"))
            slip = raw_entry * (_safe_float(slippage_bps, 0.0) / 10000.0)
            entry = raw_entry + slip if direction == "long" else raw_entry - slip

            hit_tp = _safe_float(nxt["high"]) >= raw_tp if direction == "long" else _safe_float(nxt["low"]) <= raw_tp
            hit_sl = _safe_float(nxt["low"]) <= raw_sl if direction == "long" else _safe_float(nxt["high"]) >= raw_sl

            if hit_tp and not hit_sl:
                exit_price = raw_tp
            elif hit_sl and not hit_tp:
                exit_price = raw_sl
            else:
                exit_price = _safe_float(nxt["close"])

            gross = (exit_price - entry) if direction == "long" else (entry - exit_price)
            fee = abs(entry) * (_safe_float(commission_pct, 0.0) / 100.0)
            pnl = gross - fee
            pnl_pct = (pnl / max(abs(entry), 1e-9)) * 100.0
            balance += pnl
            peak = max(peak, balance)
            drawdown = ((peak - balance) / max(peak, 1e-9)) * 100.0
            profits.append(pnl)
            equity_curve.append({"trade": len(profits), "equity": round(balance, 4)})
            drawdown_curve.append({"trade": len(profits), "drawdown": round(drawdown, 4)})

            if pnl >= 0:
                wins += 1
            else:
                losses += 1

            trade_row = {
                "run_id": run_id,
                "user_id": user_id,
                "entry_time": datetime.utcfromtimestamp(int(window[-1]["timestamp"]) / 1000).isoformat(),
                "exit_time": datetime.utcfromtimestamp(int(nxt["timestamp"]) / 1000).isoformat(),
                "pair": pair,
                "direction": direction,
                "entry_price": entry,
                "exit_price": exit_price,
                "size_usd": abs(entry),
                "pnl": pnl,
                "pnl_pct": pnl_pct,
                "phase_reached": 4,
                "rules_passed": {"p1": True, "p2": True, "p3": True, "p4": True},
                "exit_reason": "tp" if hit_tp and not hit_sl else "sl" if hit_sl and not hit_tp else "close",
            }
            db.save_backtest_trade(trade_row)
            closed_trades.append(trade_row)

        total = wins + losses
        total_pnl = sum(profits) if profits else 0.0
        max_dd = max((x["drawdown"] for x in drawdown_curve), default=0.0)
        win_rate = (wins / total) * 100.0 if total else 0.0
        positive = [p for p in profits if p > 0]
        negative = [p for p in profits if p < 0]
        avg_win = mean(positive) if positive else 0.0
        avg_loss = abs(mean(negative)) if negative else 0.0
        avg_rr = avg_win / max(avg_loss, 1e-9) if (avg_win or avg_loss) else 0.0
        profit_factor = sum(positive) / max(abs(sum(negative)), 1e-9) if profits else 0.0
        returns = [(closed_trades[i]["pnl"] / max(abs(closed_trades[i]["entry_price"]), 1e-9)) for i in range(len(closed_trades))]
        sharpe = (mean(returns) / max((mean([abs(x) for x in returns]) if returns else 0.0), 1e-9)) if returns else 0.0

        summary = {
            "status": "complete",
            "trades": total,
            "total_trades": total,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 4),
            "total_pnl": round(total_pnl, 4),
            "pnl_summary": {
                "gross": round(total_pnl, 4),
                "net": round(total_pnl, 4),
            },
            "max_drawdown": round(max_dd, 4),
            "avg_rr": round(avg_rr, 4),
            "sharpe_ratio": round(sharpe, 4),
            "profit_factor": round(profit_factor, 4),
            "equity_curve": equity_curve,
            "drawdown_curve": drawdown_curve,
            "slippage_bps": slippage_bps,
            "commission_pct": commission_pct,
        }
        db.update_backtest_run(
            run_id,
            {
                "status": "done",
                "error": None,
                "total_trades": total,
                "win_rate": summary["win_rate"],
                "total_pnl": summary["total_pnl"],
                "max_drawdown": summary["max_drawdown"],
                "avg_rr": summary["avg_rr"],
                "sharpe_ratio": summary["sharpe_ratio"],
                "profit_factor": summary["profit_factor"],
                "results_data": summary,
                "completed_at": datetime.utcnow().isoformat(),
            },
        )
        return summary
    except Exception as exc:
        msg = f"backtest_runtime_error:{exc}"
        log.exception("Backtest runtime failure run_id=%s", run_id)
        db.update_backtest_run(run_id, {"status": "failed", "error": msg, "completed_at": datetime.utcnow().isoformat()})
        return {"status": "failed", "error": msg}
