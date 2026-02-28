from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier
from backend.services.external_api import request_json
from engine.polymarket.scanner import fetch_polymarket_crypto_markets

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


class ToggleBody(BaseModel):
    active: bool


class TradeBody(BaseModel):
    market_id: str | None = None
    signal_id: int | None = None
    size_usd: float = Field(gt=0)
    side: str = "yes"
    mode: str = "demo"  # demo | live
    confirm: bool = False
    entry_price: float | None = None
    question: str | None = None


class WatchBody(BaseModel):
    market: str


class BalanceBody(BaseModel):
    amount: float = Field(gt=0)


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _market_key(market: dict) -> str:
    return str(market.get("id") or market.get("condition_id") or "")


def _build_market_map(markets: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for market in markets:
        key = _market_key(market)
        if key:
            out[key] = market
    return out


def _trade_with_pnl(trade: dict, market_map: dict[str, dict], *, live: bool) -> dict:
    market_id = str(trade.get("market_id") or trade.get("pair") or "")
    market = market_map.get(market_id, {})
    side = str(trade.get("position") or trade.get("direction") or "yes").lower()
    entry_price = _to_float(trade.get("entry_price"), _to_float(market.get("yes_price"), 0.5))
    current_yes = _to_float(market.get("yes_price"), entry_price)
    current_no = _to_float(market.get("no_price"), 1 - current_yes if current_yes else 0.5)
    current_mark = current_yes if side == "yes" else current_no
    size_usd = _to_float(trade.get("size_usd"), 0.0)
    shares = _to_float(trade.get("shares"), 0.0) or (size_usd / max(entry_price, 1e-9))
    current_value = shares * current_mark
    upnl = current_value - size_usd
    pnl_pct = (upnl / size_usd * 100.0) if size_usd > 0 else 0.0
    timestamp = trade.get("opened_at") or trade.get("created_at")
    return {
        **trade,
        "mode": "live" if live else "demo",
        "market_id": market_id,
        "question": trade.get("question") or market.get("question") or "",
        "side": side,
        "entry_price": round(entry_price, 6),
        "current_mark": round(current_mark, 6),
        "unrealized_pnl": round(upnl, 6),
        "pnl_pct": round(pnl_pct, 4),
        "shares": round(shares, 6),
        "timestamp": timestamp,
    }


@router.get("/scanner")
async def scanner(
    limit: int = Query(10, ge=1, le=25),
    user: dict = Depends(get_current_user),
):
    markets = await fetch_polymarket_crypto_markets(limit=limit)
    return ok(
        {
            "markets": markets,
            "count": len(markets),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
    )


@router.get("/wallet")
async def wallet(user: dict = Depends(get_current_user)):
    address = db.get_poly_address(user["id"])
    if not address:
        return ok({"connected": False, "polygon_address": "", "matic_balance": 0.0, "usdc_balance": 0.0})
    data, failure = await request_json("POST", "https://polygon-rpc.com", json={"jsonrpc": "2.0", "id": 1, "method": "eth_getBalance", "params": [address, "latest"]})
    if failure:
        raise HTTPException(status_code=502, detail=f"wallet_balance_failed:{failure.reason}")
    wei_hex = ((data or {}).get("result") or "0x0")
    try:
        matic = int(wei_hex, 16) / 10**18
    except Exception:
        matic = 0.0
    return ok({"connected": True, "polygon_address": address, "matic_balance": matic, "usdc_balance": 0.0})


@router.get("/models")
def models(user: dict = Depends(get_current_user)):
    return ok(db.get_prediction_models(user["id"]))


@router.post("/models")
def create_model(payload: dict[str, Any], user: dict = Depends(get_current_user)):
    mid = db.save_prediction_model(user["id"], payload)
    return ok({"id": mid})


@router.put("/models/{model_id}")
def update_model(model_id: int, payload: dict[str, Any], user: dict = Depends(get_current_user)):
    db._update("prediction_models", payload, id=model_id, user_id=user["id"])
    return ok({"id": model_id})


@router.delete("/models/{model_id}")
def delete_model(model_id: int, user: dict = Depends(get_current_user)):
    db._delete("prediction_models", id=model_id, user_id=user["id"])
    return ok({"id": model_id})


@router.post("/models/{model_id}/toggle")
def toggle(model_id: int, body: ToggleBody, user: dict = Depends(get_current_user)):
    db.toggle_prediction_model(model_id, user["id"], body.active)
    return ok({"id": model_id, "active": body.active})


@router.get("/trades")
async def trades(user: dict = Depends(get_current_user)):
    uid = user["id"]
    markets = await fetch_polymarket_crypto_markets(limit=200)
    market_map = _build_market_map(markets)
    live_open = db.get_open_poly_trades(uid)
    demo_open = db.get_open_demo_trades(uid, "poly")
    live_open_enriched = [_trade_with_pnl(row, market_map, live=True) for row in live_open]
    demo_open_enriched = [_trade_with_pnl(row, market_map, live=False) for row in demo_open]
    live_closed = db._select_many("poly_live_trades", user_id=uid, status="closed", order="closed_at", desc=True, limit=100)
    demo_closed = db.get_closed_demo_trades(uid, "poly", limit=100)
    return ok(
        {
            "open_trades": {
                "live": live_open_enriched,
                "demo": demo_open_enriched,
            },
            "closed_trades": {
                "live": live_closed,
                "demo": demo_closed,
            },
        }
    )


@router.post("/trade")
async def trade(body: TradeBody, user: dict = Depends(require_tier("pro"))):
    if body.mode == "live" and not body.confirm:
        raise HTTPException(status_code=400, detail="confirm_required")
    if body.mode == "demo":
        return demo_trade(body, user)  # type: ignore[arg-type]
    if not body.market_id:
        raise HTTPException(status_code=400, detail="market_id_required")

    side = str(body.side or "yes").lower()
    if side not in {"yes", "no"}:
        raise HTTPException(status_code=400, detail="invalid_side")
    markets = await fetch_polymarket_crypto_markets(limit=200)
    market_map = _build_market_map(markets)
    market = market_map.get(str(body.market_id))
    if not market:
        raise HTTPException(status_code=404, detail="market_not_found")

    yes_price = _to_float(market.get("yes_price"), 0.5)
    no_price = _to_float(market.get("no_price"), max(0.0, 1 - yes_price))
    entry_price = _to_float(body.entry_price, yes_price if side == "yes" else no_price)
    shares = body.size_usd / max(entry_price, 1e-9)
    row = db._insert(
        "poly_live_trades",
        {
            "user_id": user["id"],
            "market_id": str(body.market_id),
            "question": body.question or market.get("question") or "",
            "position": side,
            "entry_price": entry_price,
            "current_price": entry_price,
            "size_usd": body.size_usd,
            "shares": shares,
            "status": "open",
            "opened_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    enriched = _trade_with_pnl(row or {}, market_map, live=True) if row else None
    return ok(
        {
            "executed": True,
            "trade_id": row.get("id") if row else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "trade": enriched,
        }
    )


@router.post("/demo-trade")
def demo_trade(body: TradeBody, user: dict = Depends(get_current_user)):
    balance = db.get_demo_balance(user["id"], "poly")
    if balance < body.size_usd:
        raise HTTPException(status_code=400, detail="insufficient_balance")
    if not body.market_id:
        raise HTTPException(status_code=400, detail="market_id_required")
    side = str(body.side or "yes").lower()
    if side not in {"yes", "no"}:
        raise HTTPException(status_code=400, detail="invalid_side")

    db.set_demo_balance(user["id"], "poly", balance - body.size_usd)
    tid = db.open_demo_trade(
        user["id"],
        {
            "section": "poly",
            "pair": str(body.market_id),
            "direction": side,
            "entry_price": _to_float(body.entry_price, 0.5),
            "current_price": _to_float(body.entry_price, 0.5),
            "size_usd": body.size_usd,
            "status": "open",
            "opened_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return ok({"trade_id": tid, "balance": db.get_demo_balance(user["id"], "poly")})


@router.get("/watchlist")
def watchlist(user: dict = Depends(get_current_user)):
    return ok(db._select_many("prediction_watchlist", user_id=user["id"]))


@router.post("/watchlist")
def add_watchlist(body: WatchBody, user: dict = Depends(get_current_user)):
    row = db._insert("prediction_watchlist", {"user_id": user["id"], "market": body.market})
    return ok(row)


@router.delete("/watchlist/{item_id}")
def del_watch(item_id: int, user: dict = Depends(get_current_user)):
    db._delete("prediction_watchlist", id=item_id, user_id=user["id"])
    return ok({"id": item_id})


@router.get("/demo")
async def demo(user: dict = Depends(get_current_user)):
    uid = user["id"]
    markets = await fetch_polymarket_crypto_markets(limit=200)
    market_map = _build_market_map(markets)
    demo_open = db.get_open_demo_trades(uid, "poly")
    return ok(
        {
            "balance": db.get_demo_balance(uid, "poly"),
            "open_trades": [_trade_with_pnl(row, market_map, live=False) for row in demo_open],
        }
    )


@router.post("/demo/deposit")
def deposit(body: BalanceBody, user: dict = Depends(get_current_user)):
    bal = db.get_demo_balance(user["id"], "poly") + body.amount
    db.set_demo_balance(user["id"], "poly", bal)
    return ok({"balance": bal})


@router.post("/demo/withdraw")
def withdraw(body: BalanceBody, user: dict = Depends(get_current_user)):
    current = db.get_demo_balance(user["id"], "poly")
    if current < body.amount:
        raise HTTPException(status_code=400, detail="insufficient_balance")
    bal = current - body.amount
    db.set_demo_balance(user["id"], "poly", bal)
    return ok({"balance": bal})


@router.post("/demo/reset")
def reset(user: dict = Depends(get_current_user)):
    db.reset_demo_balance(user["id"], "poly")
    return ok({"balance": db.get_demo_balance(user["id"], "poly")})
