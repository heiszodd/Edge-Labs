from __future__ import annotations

import asyncio
from fastapi import APIRouter, Depends

from backend import db
from backend.dependencies import get_current_user
from backend.services.external_api import request_json
from engine.hyperliquid.account_reader import fetch_account_summary
from engine.solana.wallet_reader import get_sol_price_usd, get_wallet_summary

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


async def _perps_live_balance(user_id: str) -> tuple[float, bool]:
    try:
        summary = await fetch_account_summary(user_id)
        if summary.get("error"):
            return 0.0, False
        return _to_float(summary.get("accountValue"), 0.0), True
    except Exception:
        return 0.0, False


async def _predictions_live_balance(user_id: str) -> tuple[float, bool]:
    address = db.get_poly_address(user_id)
    if not address:
        return 0.0, False
    data, failure = await request_json(
        "POST",
        "https://polygon-rpc.com",
        json={"jsonrpc": "2.0", "id": 1, "method": "eth_getBalance", "params": [address, "latest"]},
    )
    if failure:
        return 0.0, False
    wei_hex = ((data or {}).get("result") or "0x0")
    try:
        matic = int(str(wei_hex), 16) / 10**18
    except Exception:
        matic = 0.0
    return matic, True


async def _degen_live_balance(user_id: str) -> tuple[float | None, bool]:
    address = db.get_sol_address(user_id)
    if not address:
        return None, False
    try:
        summary, sol_price = await asyncio.gather(get_wallet_summary(address), get_sol_price_usd())
        sol_balance = _to_float((summary or {}).get("sol_balance"), 0.0)
        usdc_balance = _to_float((summary or {}).get("usdc_balance"), 0.0)
        usd_value = (sol_balance * max(sol_price, 0.0)) + usdc_balance
        return round(usd_value, 2), True
    except Exception:
        return None, False


@router.get("/overview")
async def get_overview(user=Depends(get_current_user)):
    user_id = user["id"]

    perps_live_task = _perps_live_balance(user_id)
    degen_live_task = _degen_live_balance(user_id)
    predictions_live_task = _predictions_live_balance(user_id)
    perps_live, degen_live, predictions_live = await asyncio.gather(perps_live_task, degen_live_task, predictions_live_task)

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
            "live_balance": round(perps_live[0], 2),
            "live_balance_available": bool(perps_live[1]),
            "total_pnl": round(perps_pnl, 2),
            "roi_pct": round(perps_roi, 2),
            "open_positions": len(hl_positions or []),
            "total_trades": len(perps_trades or []),
            "win_rate": _win_rate(perps_trades or []),
        },
        "degen": {
            "demo_balance": round(degen_demo, 2),
            "live_balance": None if degen_live[0] is None else round(_to_float(degen_live[0], 0.0), 2),
            "live_balance_available": bool(degen_live[1]),
            "live_balance_unavailable_reason": None if degen_live[1] else "live_unavailable",
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
            "live_balance": round(predictions_live[0], 6),
            "live_balance_available": bool(predictions_live[1]),
            "roi_pct": 0.0,
        },
        "signals": {
            "pending_count": len(all_signals or []),
            "phase4_count": len([s for s in all_signals or [] if str(s.get("phase")) in {"4", "P4"}]),
            "recent": recent_signals,
        },
        "total_pnl": round(perps_pnl + degen_pnl + poly_pnl, 2),
        "total_balance": round(_to_float(perps_live[0], 0.0) + _to_float(predictions_live[0], 0.0) + _to_float(degen_live[0], 0.0), 2),
        "total_balance_available_count": int(bool(perps_live[1])) + int(bool(predictions_live[1])) + int(bool(degen_live[1])),
    }
