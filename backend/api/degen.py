from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier
from engine.degen.contract_scanner import scan_contract
from engine.solana.executor import execute_jupiter_swap
from engine.solana.trenches_feed import run_degen_scanner_for_user
from engine.solana.wallet_reader import get_wallet_summary

router = APIRouter(prefix="/api/degen", tags=["degen"])
log = logging.getLogger(__name__)


class AddressBody(BaseModel):
    address: str


class ToggleBody(BaseModel):
    active: bool


class BuyBody(BaseModel):
    token_address: str
    size_usd: float = Field(gt=0)
    slippage_bps: int = Field(default=100, ge=10, le=2000)
    confirm: bool = False


class DemoBuyBody(BaseModel):
    token_address: str
    size_usd: float = Field(gt=0)
    slippage_bps: int = Field(default=100, ge=10, le=2000)


class WatchBody(BaseModel):
    address: str
    note: str | None = None


class TrackedWalletBody(BaseModel):
    wallet_address: str
    label: str | None = None
    auto_mirror: bool = False


class BalanceBody(BaseModel):
    amount: float = Field(gt=0)


@router.get("/balance")
async def balance(user: dict = Depends(get_current_user)):
    address = db.get_sol_address(user["id"])
    if not address:
        return ok({"connected": False, "sol_address": "", "sol_balance": 0.0, "token_count": 0, "token_balances": []})
    summary = await get_wallet_summary(address)
    return ok(
        {
            "connected": True,
            "sol_address": address,
            "sol_balance": summary.get("sol_balance", 0.0),
            "usdc_balance": summary.get("usdc_balance", 0.0),
            "token_count": summary.get("token_count", 0),
            "token_balances": summary.get("tokens", []),
        }
    )


@router.get("/positions")
def positions(user: dict = Depends(get_current_user)):
    return ok(db.get_open_sol_positions(user["id"]))


@router.post("/scan-contract")
async def scan_contract_api(body: AddressBody, user: dict = Depends(get_current_user)):
    report = await scan_contract(body.address)
    return ok(report)


@router.get("/scanner/results")
def scanner_results(user: dict = Depends(get_current_user)):
    rows = db.get_pending_signals(user["id"], section="degen", active_only=True)
    out = []
    for row in rows:
        meta = row.get("meta") or {}
        token = meta.get("token") or {}
        report = meta.get("report") or {}
        address = token.get("address") or report.get("address") or ""
        out.append(
            {
                "id": row.get("id"),
                "token_name": report.get("symbol") or token.get("symbol") or "Unknown",
                "token_address": address,
                "token_short": address[:4],
                "price": float(report.get("price_usd") or 0),
                "liquidity": float(report.get("liquidity_usd") or 0),
                "volume": float(report.get("volume_24h") or 0),
                "risk_indicator": report.get("grade") or "D",
                "signal_strength": float(meta.get("score") or report.get("score") or 0),
                "timestamp": row.get("created_at"),
            }
        )
    return ok(out)


@router.post("/scanner/run")
async def scanner_run(user: dict = Depends(require_tier("pro"))):
    try:
        results = await run_degen_scanner_for_user(user["id"])
    except Exception:
        log.exception("Degen scanner failed for user=%s", user["id"])
        raise HTTPException(status_code=500, detail="scanner_failed")
    return ok({"queued": True, "user_id": user["id"], "results": results, "timestamp": datetime.now(timezone.utc).isoformat()})


@router.get("/models")
def get_models(user: dict = Depends(get_current_user)):
    return ok(db.get_degen_models(user["id"]))


@router.post("/models")
def create_model(payload: dict[str, Any], user: dict = Depends(get_current_user)):
    mid = db.save_degen_model(user["id"], payload)
    return ok({"id": mid})


@router.put("/models/{model_id}")
def update_model(model_id: int, payload: dict[str, Any], user: dict = Depends(get_current_user)):
    db._update("degen_models", payload, id=model_id, user_id=user["id"])
    return ok({"id": model_id})


@router.delete("/models/{model_id}")
def delete_model(model_id: int, user: dict = Depends(get_current_user)):
    db._delete("degen_models", id=model_id, user_id=user["id"])
    return ok({"id": model_id})


@router.post("/models/{model_id}/toggle")
def toggle_model(model_id: int, body: ToggleBody, user: dict = Depends(get_current_user)):
    db.toggle_degen_model(model_id, user["id"], body.active)
    return ok({"id": model_id, "active": body.active})


@router.post("/buy")
async def buy(body: BuyBody, user: dict = Depends(require_tier("pro"))):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="confirm_required")
    result = await execute_jupiter_swap(
        user["id"],
        {"token_address": body.token_address, "size_usd": body.size_usd, "slippage_bps": body.slippage_bps},
    )
    if not result.get("success"):
        reason = str(result.get("error") or "rpc_failure")
        raise HTTPException(status_code=502, detail=f"order_failed:{reason}")
    return ok({"executed": True, **result, "timestamp": datetime.now(timezone.utc).isoformat()})


@router.post("/demo-buy")
def demo_buy(body: DemoBuyBody, user: dict = Depends(get_current_user)):
    balance = db.get_demo_balance(user["id"], "sol")
    if balance < body.size_usd:
        raise HTTPException(status_code=400, detail="insufficient_balance")
    db.set_demo_balance(user["id"], "sol", balance - body.size_usd)
    trade_id = db.open_demo_trade(
        user["id"],
        {
            "section": "sol",
            "token_address": body.token_address,
            "size_usd": body.size_usd,
            "status": "open",
            "opened_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return ok({"trade_id": trade_id, "balance": db.get_demo_balance(user["id"], "sol")})


@router.get("/watchlist")
def get_watchlist(user: dict = Depends(get_current_user)):
    rows = db.get_solana_watchlist(user["id"])
    return ok(rows)


@router.post("/watchlist")
def add_watchlist(body: WatchBody, user: dict = Depends(get_current_user)):
    db.save_solana_watchlist(user["id"], body.address, body.note or "")
    return ok({"address": body.address})


@router.delete("/watchlist/{item_id}")
def delete_watchlist(item_id: int, user: dict = Depends(get_current_user)):
    db.delete_solana_watchlist(user["id"], item_id)
    return ok({"id": item_id})


@router.get("/blacklist")
def get_black(user: dict = Depends(get_current_user)):
    return ok(db.get_blacklist(user["id"]))


@router.post("/blacklist")
def add_black(body: WatchBody, user: dict = Depends(get_current_user)):
    db.add_to_blacklist(user["id"], body.address, body.note or "")
    return ok({"address": body.address})


@router.delete("/blacklist/{item_id}")
def delete_black(item_id: int, user: dict = Depends(get_current_user)):
    db._delete("blacklist", id=item_id, user_id=user["id"])
    return ok({"id": item_id})


@router.get("/tracked-wallets")
def tracked_wallets(user: dict = Depends(get_current_user)):
    return ok(db.get_tracked_wallets(user["id"]))


@router.post("/tracked-wallets")
def add_tracked(body: TrackedWalletBody, user: dict = Depends(get_current_user)):
    db.save_tracked_wallet(user["id"], body.model_dump())
    return ok(body.model_dump())


@router.put("/tracked-wallets/{item_id}")
def update_tracked(item_id: int, body: TrackedWalletBody, user: dict = Depends(get_current_user)):
    db._update("tracked_wallets", body.model_dump(), id=item_id, user_id=user["id"])
    return ok({"id": item_id})


@router.delete("/tracked-wallets/{item_id}")
def delete_tracked(item_id: int, user: dict = Depends(get_current_user)):
    db._delete("tracked_wallets", id=item_id, user_id=user["id"])
    return ok({"id": item_id})


@router.get("/tracked-wallets/export")
def export_tracked_wallets(user: dict = Depends(get_current_user)):
    rows = db.get_tracked_wallets(user["id"])
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["wallet_address", "label", "auto_mirror", "win_rate", "pnl_from_copies", "added_at"])
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                "wallet_address": row.get("wallet_address"),
                "label": row.get("label"),
                "auto_mirror": row.get("auto_mirror"),
                "win_rate": row.get("win_rate"),
                "pnl_from_copies": row.get("pnl_from_copies"),
                "added_at": row.get("added_at"),
            }
        )
    return PlainTextResponse(content=output.getvalue(), media_type="text/csv")


@router.get("/demo")
def get_demo(user: dict = Depends(get_current_user)):
    return ok({"balance": db.get_demo_balance(user["id"], "sol"), "open_trades": db.get_open_demo_trades(user["id"], "sol")})


@router.get("/demo/history")
def demo_history(user: dict = Depends(get_current_user)):
    return ok({"open": db.get_open_demo_trades(user["id"], "sol"), "closed": db.get_closed_demo_trades(user["id"], "sol", limit=200)})


@router.post("/demo/deposit")
def deposit(body: BalanceBody, user: dict = Depends(get_current_user)):
    bal = db.get_demo_balance(user["id"], "sol") + body.amount
    db.set_demo_balance(user["id"], "sol", bal)
    return ok({"balance": bal})


@router.post("/demo/withdraw")
def withdraw_demo(body: BalanceBody, user: dict = Depends(get_current_user)):
    current = db.get_demo_balance(user["id"], "sol")
    if current < body.amount:
        raise HTTPException(status_code=400, detail="insufficient_balance")
    bal = current - body.amount
    db.set_demo_balance(user["id"], "sol", bal)
    return ok({"balance": bal})


@router.post("/demo/reset")
def reset(user: dict = Depends(get_current_user)):
    db.reset_demo_balance(user["id"], "sol")
    return ok({"balance": db.get_demo_balance(user["id"], "sol")})


@router.post("/demo/clear-logs")
def clear_logs(user: dict = Depends(get_current_user)):
    db.clear_demo_trades(user["id"], "sol")
    return ok({"cleared": True})
