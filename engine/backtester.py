from __future__ import annotations

from datetime import datetime

from backend import db
from engine.ohlcv_cache import fetch_candles_range
from engine.phase_engine import _make_trade_plan
from engine.rules import evaluate_rule


async def run_backtest(run_id, user_id, model, pair, timeframe, start_date, end_date, capital) -> dict:
    db._update("backtest_runs", {"status": "running"}, id=run_id, user_id=user_id)
    start_ms = int(datetime.fromisoformat(start_date).timestamp() * 1000)
    end_ms = int(datetime.fromisoformat(end_date).timestamp() * 1000)
    candles = await fetch_candles_range(pair, timeframe, start_ms, end_ms)
    if len(candles) < 120:
        summary = {"trades": 0, "win_rate": 0.0, "total_pnl": 0.0, "max_drawdown": 0.0, "avg_rr": 0.0, "sharpe_ratio": 0.0, "profit_factor": 0.0}
        db._update("backtest_runs", {"status": "done", "result": summary}, id=run_id, user_id=user_id)
        return summary
    bal = float(capital)
    peak = bal
    wins = losses = 0
    profits = []
    for i in range(100, len(candles)-1):
        w = candles[i-100:i]
        p1 = evaluate_rule("rule_htf_bullish", w) or evaluate_rule("rule_htf_bearish", w)
        p2 = evaluate_rule("rule_bos_bullish", w) or evaluate_rule("rule_bos_bearish", w)
        p3 = evaluate_rule("rule_ote_zone", w)
        p4 = evaluate_rule("rule_candle_confirmation", w)
        if not (p1 and p2 and p3 and p4):
            continue
        direction = "long" if w[-1]["close"] >= w[-1]["open"] else "short"
        plan = _make_trade_plan(w, direction)
        nxt = candles[i+1]
        entry, sl, tp = plan["entry"], plan["sl"], plan["tp"]
        hit_tp = float(nxt["high"]) >= tp if direction == "long" else float(nxt["low"]) <= tp
        hit_sl = float(nxt["low"]) <= sl if direction == "long" else float(nxt["high"]) >= sl
        if hit_tp and not hit_sl:
            pnl = abs(tp-entry)
            wins += 1
        elif hit_sl and not hit_tp:
            pnl = -abs(entry-sl)
            losses += 1
        else:
            pnl = float(nxt["close"]) - entry if direction == "long" else entry - float(nxt["close"])
            wins += pnl > 0
            losses += pnl <= 0
        bal += pnl
        peak = max(peak, bal)
        profits.append(pnl)
        db._insert("backtest_trades", {"run_id": run_id, "user_id": user_id, "pair": pair, "timeframe": timeframe, "direction": direction, "entry": entry, "sl": sl, "tp": tp, "pnl": pnl})
    total = wins + losses
    total_pnl = bal - float(capital)
    max_dd = 0.0 if peak == 0 else (peak - bal) / peak
    win_rate = (wins / total) if total else 0.0
    avg_rr = sum(p for p in profits if p > 0) / max(abs(sum(p for p in profits if p < 0)), 1e-9)
    sharpe = (sum(profits) / max(len(profits), 1)) / max((sum(abs(p) for p in profits) / max(len(profits), 1)), 1e-9)
    profit_factor = sum(p for p in profits if p > 0) / max(abs(sum(p for p in profits if p < 0)), 1e-9)
    summary = {"trades": total, "win_rate": win_rate, "total_pnl": total_pnl, "max_drawdown": max_dd, "avg_rr": avg_rr, "sharpe_ratio": sharpe, "profit_factor": profit_factor}
    db._update("backtest_runs", {"status": "done", "result": summary}, id=run_id, user_id=user_id)
    return summary
