from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier
from engine.backtester import run_backtest as run_backtest_engine

router = APIRouter(prefix="/api/backtest", tags=["backtesting"])


class BacktestBody(BaseModel):
    model_id: int
    pair: str
    timeframe: str
    start_date: str
    end_date: str
    capital: float = Field(gt=0)
    slippage_bps: float = Field(default=0.0, ge=0, le=1000)
    commission_pct: float = Field(default=0.0, ge=0, le=10)


@router.post("/run")
async def run_backtest(body: BacktestBody, user: dict = Depends(require_tier("pro"))):
    model = db.get_model(body.model_id, user["id"])
    if not model:
        raise HTTPException(status_code=404, detail="model_not_found")
    run_id = db.create_backtest_run(
        user["id"],
        {
            "model_id": body.model_id,
            "pair": body.pair,
            "timeframe": body.timeframe,
            "start_date": body.start_date,
            "end_date": body.end_date,
            "initial_capital": body.capital,
            "status": "pending",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "results_data": {},
        },
    )
    await run_backtest_engine(
        run_id,
        user["id"],
        model,
        body.pair,
        body.timeframe,
        body.start_date,
        body.end_date,
        body.capital,
        slippage_bps=body.slippage_bps,
        commission_pct=body.commission_pct,
    )
    return ok({"run_id": run_id})


@router.get("/{run_id}")
def get_run(run_id: int, user: dict = Depends(get_current_user)):
    run = db.get_backtest_run(run_id, user["id"])
    if not run:
        raise HTTPException(status_code=404, detail="run_not_found")
    result = run.get("result") if isinstance(run.get("result"), dict) else run.get("results_data") if isinstance(run.get("results_data"), dict) else {}
    trades = db._select_many("backtest_trades", run_id=run_id, user_id=user["id"], order="id")
    result["trades"] = trades or result.get("trades", [])
    return ok(result)


@router.get("/history")
def history(user: dict = Depends(get_current_user)):
    return ok(db.get_backtest_history(user["id"]))
