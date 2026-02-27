from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier
from backend.services.external_api import request_json
from engine.polymarket.scanner import run_market_scanner

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


class WatchBody(BaseModel):
    market: str


class BalanceBody(BaseModel):
    amount: float = Field(gt=0)


@router.get("/scanner")
async def scanner(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, le=10_000),
    category: str = Query("all"),
    user: dict = Depends(get_current_user),
):
    rows = await run_market_scanner(limit=limit, offset=offset, category=category)
    out = []
    for row in rows:
        market = row.get("market") or {}
        out.append(
            {
                "market_id": market.get("id") or market.get("conditionId") or market.get("questionID"),
                "market": market.get("question") or market.get("slug") or "Unknown market",
                "score": float(row.get("score") or 0),
                "grade": "A" if row.get("score", 0) >= 80 else "B" if row.get("score", 0) >= 65 else "C",
                "category": market.get("category") or "uncategorized",
                "liquidity": float(market.get("liquidity") or 0),
                "volume": float(market.get("volume") or 0),
                "yes_price": float(market.get("outcomePrices", [0.5])[0] if market.get("outcomePrices") else market.get("lastTradePrice", 0.5) or 0.5),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    return ok({"items": out, "limit": limit, "offset": offset, "category": category})


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
def trades(user: dict = Depends(get_current_user)):
    return ok(db.get_open_poly_trades(user["id"]))


@router.post("/trade")
def trade(body: TradeBody, user: dict = Depends(require_tier("pro"))):
    if body.mode == "live" and not body.confirm:
        raise HTTPException(status_code=400, detail="confirm_required")
    if body.mode == "demo":
        return demo_trade(body, user)  # type: ignore[arg-type]
    return ok({"executed": True, **body.model_dump(), "timestamp": datetime.now(timezone.utc).isoformat()})


@router.post("/demo-trade")
def demo_trade(body: TradeBody, user: dict = Depends(get_current_user)):
    balance = db.get_demo_balance(user["id"], "poly")
    if balance < body.size_usd:
        raise HTTPException(status_code=400, detail="insufficient_balance")
    db.set_demo_balance(user["id"], "poly", balance - body.size_usd)
    tid = db.open_demo_trade(
        user["id"],
        {
            "section": "poly",
            "market_id": body.market_id,
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
def demo(user: dict = Depends(get_current_user)):
    return ok({"balance": db.get_demo_balance(user["id"], "poly"), "open_trades": db.get_open_demo_trades(user["id"], "poly")})


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
