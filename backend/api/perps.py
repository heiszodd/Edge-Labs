from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier
from engine.hyperliquid.account_reader import (
    fetch_account_summary,
    fetch_api_health,
    fetch_open_orders_parsed,
    fetch_positions_with_prices,
    fetch_trade_history,
)
from engine.ohlcv_cache import fetch_candles
from engine.phase_engine import run_model

router = APIRouter(prefix="/api/perps", tags=["perps"])
log = logging.getLogger(__name__)


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


class BalanceBody(BaseModel):
    amount: float = Field(gt=0)


class WithdrawBody(BaseModel):
    address: str = Field(min_length=8, max_length=120)
    amount: float = Field(gt=0)
    confirm: bool = False


class ScannerRunBody(BaseModel):
    model_ids: list[int] = Field(default_factory=list)
    pairs: list[str] = Field(default_factory=list)
    include_all_models: bool = False
    include_all_pairs: bool = False


def _parse_iso(value: str | None) -> datetime:
    raw = str(value or datetime.now(timezone.utc).isoformat())
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def _normalize_order_status(raw: str) -> str:
    value = str(raw or "").lower()
    if "fill" in value and "partial" in value:
        return "partially_filled"
    if "fill" in value:
        return "filled"
    if "cancel" in value:
        return "cancelled"
    if "reject" in value:
        return "rejected"
    return "open"


def _normalize_order(row: dict[str, Any]) -> dict[str, Any]:
    side = "buy" if bool(row.get("side") or row.get("isBuy")) else "sell"
    return {
        "order_id": str(row.get("oid") or row.get("order_id") or ""),
        "coin": row.get("coin"),
        "side": side,
        "order_type": str(row.get("orderType") or row.get("type") or "limit").lower(),
        "price": float(row.get("limitPx") or row.get("price") or 0),
        "size": float(row.get("sz") or row.get("size") or 0),
        "size_usd": float(row.get("origSz") or row.get("size_usd") or 0),
        "status": _normalize_order_status(str(row.get("status") or "open")),
        "created_at": row.get("timestamp"),
    }


def _normalize_fill(fill: dict[str, Any]) -> dict[str, Any]:
    side = "buy" if bool(fill.get("side") or fill.get("isBuy")) else "sell"
    return {
        "coin": fill.get("coin"),
        "side": side,
        "size": float(fill.get("sz") or fill.get("size") or 0),
        "size_usd": float(fill.get("px") or 0) * float(fill.get("sz") or fill.get("size") or 0),
        "entry_price": float(fill.get("px") or fill.get("price") or 0),
        "closed_pnl": float(fill.get("closedPnl") or fill.get("pnl") or 0),
        "timestamp": fill.get("time") or fill.get("timestamp"),
        "hash": str(fill.get("hash") or fill.get("tid") or ""),
        "status": _normalize_order_status(str(fill.get("dir") or "filled")),
    }


async def _load_hl_account(uid: str) -> dict[str, Any]:
    address = db.get_hl_address(uid)
    key = db.get_encrypted_key(uid, "hl_pk")
    if not address:
        return {
            "connected": False,
            "hl_address": "",
            "equity": 0.0,
            "available": 0.0,
            "margin_used": 0.0,
            "error": {"reason": "missing_wallet", "detail": "Hyperliquid wallet not connected"},
        }
    if not key:
        return {
            "connected": False,
            "hl_address": address,
            "equity": 0.0,
            "available": 0.0,
            "margin_used": 0.0,
            "error": {"reason": "invalid_api_keys", "detail": "Hyperliquid private key missing"},
        }
    summary, failure = await fetch_account_summary(address)
    return {
        "connected": failure is None,
        "hl_address": address,
        "equity": summary.get("account_value", 0.0),
        "available": summary.get("available", 0.0),
        "margin_used": summary.get("margin_used", 0.0),
        "error": None
        if failure is None
        else {
            "reason": failure.reason,
            "detail": failure.detail,
            "status_code": failure.status_code,
            "response_body": failure.response_body,
        },
    }


@router.get("/health")
async def get_hl_health(user: dict = Depends(get_current_user)):
    health = await fetch_api_health()
    color = "green" if health["status"] == "connected" else "red"
    return ok({**health, "indicator": color, "timestamp": datetime.now(timezone.utc).isoformat()})


@router.get("/account")
async def get_account(
    refresh_secs: int = Query(7, ge=3, le=60),
    user: dict = Depends(get_current_user),
):
    account = await _load_hl_account(user["id"])
    return ok({**account, "refresh_secs": refresh_secs})


@router.get("/positions")
async def get_positions(sync: bool = Query(True), user: dict = Depends(get_current_user)):
    address = db.get_hl_address(user["id"])
    if not address:
        return ok([])
    if sync:
        positions, failure = await fetch_positions_with_prices(address)
        if failure:
            raise HTTPException(status_code=502, detail=f"positions_sync_failed:{failure.reason}")
        db.upsert_hl_positions(user["id"], positions)
    return ok(db.get_hl_positions(user["id"]))


@router.get("/orders")
async def get_orders(sync: bool = Query(True), user: dict = Depends(get_current_user)):
    address = db.get_hl_address(user["id"])
    if not address:
        return ok([])
    if sync:
        rows, failure = await fetch_open_orders_parsed(address)
        if failure:
            raise HTTPException(status_code=502, detail=f"orders_sync_failed:{failure.reason}")
        normalized = [_normalize_order(x) for x in rows]
        db.upsert_hl_orders(user["id"], normalized)
    return ok(db.get_hl_orders(user["id"], limit=200))


@router.get("/history")
async def get_history(limit: int = Query(100, ge=1, le=500), sync: bool = Query(True), user: dict = Depends(get_current_user)):
    address = db.get_hl_address(user["id"])
    if address and sync:
        rows, failure = await fetch_trade_history(address, limit=limit)
        if not failure:
            existing = {str(x.get("hash") or x.get("tid")) for x in db.get_hl_trade_history(user["id"], limit=1000)}
            for item in rows:
                normalized = _normalize_fill(item)
                sig = str(normalized.get("hash") or normalized.get("timestamp") or "")
                if sig and sig in existing:
                    continue
                db.save_hl_trade(user["id"], normalized)
    history = db.get_hl_trade_history(user["id"], limit=limit)
    return ok(history)


@router.get("/deposit")
def get_deposit(user: dict = Depends(get_current_user)):
    address = db.get_hl_address(user["id"])
    if not address:
        raise HTTPException(status_code=400, detail="wallet_not_connected")
    return ok({"deposit_address": address, "copy_value": address})


@router.post("/withdraw")
async def withdraw(body: WithdrawBody, user: dict = Depends(require_tier("pro"))):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="confirm_required")
    if not re.fullmatch(r"[0-9A-Za-z]{8,120}", body.address):
        raise HTTPException(status_code=400, detail="invalid_address")
    account = await _load_hl_account(user["id"])
    if account.get("error"):
        raise HTTPException(status_code=502, detail=f"withdraw_blocked:{account['error']['reason']}")
    if float(account.get("available", 0.0)) < float(body.amount):
        raise HTTPException(status_code=400, detail="insufficient_balance")
    return ok(
        {
            "status": "accepted",
            "mode": "manual_confirmation_required",
            "address": body.address,
            "amount": body.amount,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


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
async def run_scanner(body: ScannerRunBody, user: dict = Depends(require_tier("pro"))):
    all_models = db.get_user_models(user["id"], active_only=True)
    if not all_models:
        raise HTTPException(status_code=400, detail="no_active_models")
    selected = all_models
    if body.model_ids and not body.include_all_models:
        wanted = set(body.model_ids)
        selected = [m for m in all_models if int(m.get("id") or 0) in wanted]
    if not selected:
        raise HTTPException(status_code=400, detail="no_selected_models")
    pairs = [p.upper() for p in body.pairs if p]
    started_at = datetime.now(timezone.utc)
    executed = 0
    try:
        for model in selected:
            model_pairs = pairs if (pairs and not body.include_all_pairs) else [str(model.get("pair") or "BTCUSDT").upper()]
            for pair in model_pairs:
                model_copy = {**model, "pair": pair}
                await run_model(model_copy, user["id"], None)
                executed += 1
    except Exception:
        log.exception("Perps scanner failed for user=%s", user["id"])
        raise HTTPException(status_code=500, detail="scanner_failed")
    signals = db.get_pending_signals(user["id"], section="perps", active_only=True)
    recent = [s for s in signals if _parse_iso(s.get("created_at")) >= started_at]
    results = [
        {
            "id": s.get("id"),
            "pair": s.get("pair"),
            "timestamp": s.get("created_at"),
            "signal_strength": float(s.get("score") or s.get("quality_score") or 0),
            "grade": s.get("grade") or s.get("quality_grade"),
        }
        for s in recent
    ]
    return ok({"executed_models": executed, "timestamp": started_at.isoformat(), "results": results})


@router.get("/pending")
def get_pending(user: dict = Depends(get_current_user)):
    signals = db.get_pending_signals(user["id"], section="perps", active_only=True)
    if user.get("subscription_tier", "free") == "free":
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
        signals = [s for s in signals if _parse_iso(s.get("created_at")) <= cutoff]
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
    trade_id = db.open_demo_trade(
        user["id"],
        {
            "section": "perps",
            "signal_id": body.signal_id,
            "size_usd": body.size_usd,
            "status": "open",
            "opened_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return ok({"trade_id": trade_id})


@router.get("/demo")
def get_demo(user: dict = Depends(get_current_user)):
    return ok({"balance": db.get_demo_balance(user["id"], "perps"), "open_trades": db.get_open_demo_trades(user["id"], "perps")})


@router.get("/demo/history")
def get_demo_history(user: dict = Depends(get_current_user)):
    return ok(
        {
            "open": db.get_open_demo_trades(user["id"], "perps"),
            "closed": db.get_closed_demo_trades(user["id"], "perps", limit=200),
        }
    )


@router.post("/demo/deposit")
def demo_deposit(body: BalanceBody, user: dict = Depends(get_current_user)):
    bal = db.get_demo_balance(user["id"], "perps") + body.amount
    db.set_demo_balance(user["id"], "perps", bal)
    return ok({"balance": bal})


@router.post("/demo/withdraw")
def demo_withdraw(body: BalanceBody, user: dict = Depends(get_current_user)):
    current = db.get_demo_balance(user["id"], "perps")
    if current < body.amount:
        raise HTTPException(status_code=400, detail="insufficient_balance")
    bal = current - body.amount
    db.set_demo_balance(user["id"], "perps", bal)
    return ok({"balance": bal})


@router.post("/demo/reset")
def demo_reset(user: dict = Depends(get_current_user)):
    db.reset_demo_balance(user["id"], "perps")
    return ok({"balance": db.get_demo_balance(user["id"], "perps")})


@router.post("/demo/clear-logs")
def demo_clear_logs(user: dict = Depends(get_current_user)):
    db.clear_demo_trades(user["id"], "perps")
    return ok({"cleared": True})


@router.get("/risk")
def get_risk(user: dict = Depends(get_current_user)):
    return ok(db.get_risk_settings(user["id"], "perps"))


@router.put("/risk")
def put_risk(payload: dict[str, Any], user: dict = Depends(get_current_user)):
    db.save_risk_settings(user["id"], "perps", payload)
    return ok(db.get_risk_settings(user["id"], "perps"))
