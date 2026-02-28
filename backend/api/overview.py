from __future__ import annotations

from fastapi import APIRouter, Depends

from backend import db
from backend.dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["overview"])


def _to_float(value, default: float = 0.0) -> float:
    try:
        return float(value or 0)
    except Exception:
        return default


def _win_rate(trades: list[dict]) -> float:
    if not trades:
        return 0.0
    wins = len([t for t in trades if _to_float(t.get("pnl", t.get("closed_pnl", 0))) > 0])
    return round((wins / len(trades)) * 100, 1)


def _sum_pnl(trades: list[dict]) -> float:
    return round(sum(_to_float(t.get("pnl", t.get("closed_pnl", 0))) for t in trades), 2)


def _invested_perps(trades: list[dict]) -> float:
    total = 0.0
    for t in trades:
        pnl = _to_float(t.get("pnl", t.get("closed_pnl", 0)))
        if pnl < 0:
            size = _to_float(t.get("size", t.get("size_usd", 0)))
            entry = _to_float(t.get("entry", t.get("entry_price", 0)))
            notional = abs(size * entry) if entry else abs(size)
            total += notional
    return total


def _invested_degen(trades: list[dict]) -> float:
    total = 0.0
    for t in trades:
        pnl = _to_float(t.get("pnl", t.get("closed_pnl", 0)))
        if pnl < 0:
            total += abs(_to_float(t.get("size_usd", t.get("amount_sol", 0)))
                         * max(_to_float(t.get("entry_price", 1)), 1))
    return total


@router.get("/overview")
async def get_overview(user=Depends(get_current_user)):
    user_id = user["id"]

    perps_demo = _to_float(db.get_demo_balance(user_id, "perps"), 10000.0)
    perps_trades = db.get_trade_history(user_id, "perps", limit=200)
    perps_pnl = _sum_pnl(perps_trades)
    perps_invested = _invested_perps(perps_trades)
    perps_roi = (perps_pnl / perps_invested * 100) if perps_invested > 0 else 0.0

    degen_demo = _to_float(db.get_demo_balance(user_id, "sol"), 10000.0)
    degen_trades = db.get_trade_history(user_id, "degen", limit=200)
    degen_pnl = _sum_pnl(degen_trades)
    degen_invested = _invested_degen(degen_trades)
    degen_roi = (degen_pnl / degen_invested * 100) if degen_invested > 0 else 0.0

    poly_trades = db.get_poly_trades(user_id, limit=200)
    poly_pnl = _sum_pnl(poly_trades)

    all_signals = db.get_all_pending_signals(user_id)
    hl_positions = db.get_hl_positions(user_id)
    sol_positions = db.get_sol_positions(user_id)

    recent_signals = [
        {
            "id": s.get("id"),
            "section": s.get("section"),
            "pair": s.get("pair"),
            "direction": s.get("direction"),
            "phase": s.get("phase"),
            "quality_score": s.get("score", s.get("quality_score", 0)),
            "created_at": s.get("created_at"),
        }
        for s in (all_signals or [])[:5]
    ]

    return {
        "perps": {
            "demo_balance": round(perps_demo, 2),
            "total_pnl": round(perps_pnl, 2),
            "roi_pct": round(perps_roi, 2),
            "open_positions": len(hl_positions or []),
            "total_trades": len(perps_trades or []),
            "win_rate": _win_rate(perps_trades or []),
        },
        "degen": {
            "demo_balance": round(degen_demo, 2),
            "total_pnl": round(degen_pnl, 2),
            "roi_pct": round(degen_roi, 2),
            "open_positions": len(sol_positions or []),
            "total_trades": len(degen_trades or []),
            "win_rate": _win_rate(degen_trades or []),
        },
        "predictions": {
            "total_pnl": round(poly_pnl, 2),
            "total_trades": len(poly_trades or []),
            "win_rate": _win_rate(poly_trades or []),
            "open_positions": len(db.get_open_poly_trades(user_id) or []),
            "demo_balance": round(_to_float(db.get_demo_balance(user_id, "poly"), 10000.0), 2),
            "roi_pct": 0.0,
        },
        "signals": {
            "pending_count": len(all_signals or []),
            "phase4_count": len([s for s in all_signals or [] if str(s.get("phase")) in {"4", "P4"}]),
            "recent": recent_signals,
        },
        "total_pnl": round(perps_pnl + degen_pnl + poly_pnl, 2),
    }
