from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier

router = APIRouter(prefix='/api/backtest', tags=['backtesting'])


class BacktestBody(BaseModel):
    model_id: int
    pair: str
    timeframe: str
    start_date: str
    end_date: str
    capital: float


@router.post('/run')
def run_backtest(body: BacktestBody, user: dict = Depends(require_tier('pro'))):
    run_id = db.create_backtest_run(user['id'], {**body.model_dump(), 'status': 'pending', 'created_at': datetime.now(timezone.utc).isoformat()})
    return ok({'run_id': run_id})


@router.get('/{run_id}')
def get_run(run_id: int, user: dict = Depends(get_current_user)):
    return ok(db.get_backtest_run(run_id, user['id']))


@router.get('/history')
def history(user: dict = Depends(get_current_user)):
    return ok(db.get_backtest_history(user['id']))
