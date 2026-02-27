from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier
from engine.ohlcv_cache import fetch_candles

router = APIRouter(prefix="/api/perps", tags=["perps"])


class ModelBody(BaseModel):
    name: str
    pair: str | None = None
    timeframe: str | None = None
    active: bool = True
    description: str | None = None
    model_meta: dict[str, Any] = Field(default_factory=dict)
    phase1_rules: list[dict[str, Any]] = Field(default_factory=list)
    phase2_rules: list[dict[str, Any]] = Field(default_factory=list)
    phase3_rules: list[dict[str, Any]] = Field(default_factory=list)
    phase4_rules: list[dict[str, Any]] = Field(default_factory=list)
    min_quality_score: float | None = None
    grade: str | None = None
    is_preset: bool = False
    is_public: bool = False


class ToggleBody(BaseModel):
    active: bool


class TradeBody(BaseModel):
    signal_id: int
    size_usd: float
    leverage: float | None = None
    confirm_id: str | None = None


class DemoTradeBody(BaseModel):
    signal_id: int
    size_usd: float


class DepositBody(BaseModel):
    amount: float


@router.get("/account")
def get_account(user: dict = Depends(get_current_user)):
    address = db.get_hl_address(user["id"])
    return ok({"hl_address": address, "equity": 0.0, "available": 0.0})


@router.get("/positions")
def get_positions(user: dict = Depends(get_current_user)):
    return ok(db.get_hl_positions(user["id"]))


@router.get("/orders")
def get_orders(user: dict = Depends(get_current_user)):
    return ok([])


@router.get("/history")
def get_history(user: dict = Depends(get_current_user)):
    return ok(db.get_hl_trade_history(user["id"]))


@router.get("/ohlcv")
async def get_ohlcv(
    pair: str = Query("BTCUSDT"),
    timeframe: str = Query("1h"),
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    candles = await fetch_candles(pair, timeframe, limit)
    return ok({"pair": pair, "timeframe": timeframe, "candles": candles})


@router.get("/models")
def list_models(user: dict = Depends(get_current_user)):
    return ok(db.get_user_models(user["id"]))


@router.post("/models")
def create_model(body: ModelBody, user: dict = Depends(get_current_user)):
    model_id = db.save_model(user["id"], body.model_dump(exclude_none=True))
    if model_id <= 0:
        raise HTTPException(status_code=400, detail="Model could not be saved")
    return ok({"id": model_id})


@router.put("/models/{model_id}")
def update_model(model_id: int, body: ModelBody, user: dict = Depends(get_current_user)):
    updated = db.update_model(model_id, user["id"], body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=400, detail="Model could not be updated")
    return ok({"id": model_id})


@router.delete("/models/{model_id}")
def remove_model(model_id: int, user: dict = Depends(get_current_user)):
    db.delete_model(model_id, user["id"])
    return ok({"id": model_id})


@router.post("/models/{model_id}/toggle")
def toggle_model(model_id: int, body: ToggleBody, user: dict = Depends(get_current_user)):
    db.toggle_model(model_id, user["id"], body.active)
    return ok({"id": model_id, "active": body.active})


@router.post("/scanner/run")
def run_scanner(user: dict = Depends(require_tier("pro"))):
    return ok({"queued": True, "user_id": user["id"]})


@router.get("/pending")
def get_pending(user: dict = Depends(get_current_user)):
    signals = db.get_pending_signals(user["id"], section="perps", active_only=True)
    if user.get("subscription_tier", "free") == "free":
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
        signals = [s for s in signals if datetime.fromisoformat(str(s.get("created_at", datetime.now(timezone.utc).isoformat())).replace("Z", "+00:00")) <= cutoff]
    return ok(signals)


@router.post("/pending/{signal_id}/dismiss")
def dismiss_pending(signal_id: int, user: dict = Depends(get_current_user)):
    db.dismiss_signal(signal_id, user["id"])
    return ok({"id": signal_id, "status": "dismissed"})


@router.post("/trade")
def live_trade(body: TradeBody, user: dict = Depends(require_tier("pro"))):
    return ok({"executed": True, **body.model_dump(), "user_id": user["id"]})


@router.post("/demo-trade")
def demo_trade(body: DemoTradeBody, user: dict = Depends(get_current_user)):
    trade_id = db.open_demo_trade(user["id"], {"section": "perps", "signal_id": body.signal_id, "size_usd": body.size_usd, "status": "open", "opened_at": datetime.now(timezone.utc).isoformat()})
    return ok({"trade_id": trade_id})


@router.get("/demo")
def get_demo(user: dict = Depends(get_current_user)):
    return ok({"balance": db.get_demo_balance(user["id"], "perps"), "open_trades": db.get_open_demo_trades(user["id"], "perps")})


@router.post("/demo/deposit")
def demo_deposit(body: DepositBody, user: dict = Depends(get_current_user)):
    bal = db.get_demo_balance(user["id"], "perps") + body.amount
    db.set_demo_balance(user["id"], "perps", bal)
    return ok({"balance": bal})


@router.post("/demo/reset")
def demo_reset(user: dict = Depends(get_current_user)):
    db.reset_demo_balance(user["id"], "perps")
    return ok({"balance": db.get_demo_balance(user["id"], "perps")})


@router.get("/risk")
def get_risk(user: dict = Depends(get_current_user)):
    return ok(db.get_risk_settings(user["id"], "perps"))


@router.put("/risk")
def put_risk(payload: dict[str, Any], user: dict = Depends(get_current_user)):
    db.save_risk_settings(user["id"], "perps", payload)
    return ok(db.get_risk_settings(user["id"], "perps"))
