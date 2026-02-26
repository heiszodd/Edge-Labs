from __future__ import annotations

from fastapi import APIRouter, Depends

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier

router = APIRouter(prefix='/api/analytics', tags=['analytics'])


@router.get('/performance')
def performance(section: str = 'all', period: str = '30d', user: dict = Depends(get_current_user)):
    return ok({'section': section, 'period': period, 'total_trades': 0, 'win_rate': 0, 'total_pnl': 0, 'avg_rr': 0, 'max_drawdown': 0, 'best_pair': None, 'best_hour': None})


@router.get('/trade-history')
def trade_history(user: dict = Depends(get_current_user)):
    return ok({'perps': db.get_hl_trade_history(user['id']), 'degen': db._select_many('sol_positions', user_id=user['id'], status='closed'), 'predictions': db._select_many('poly_live_trades', user_id=user['id'], status='closed')})


@router.post('/ai-insights')
def ai_insights_start(user: dict = Depends(require_tier('premium'))):
    return ok({'job_id': f"ins-{user['id']}"})


@router.get('/ai-insights')
def ai_insights_get(user: dict = Depends(require_tier('premium'))):
    return ok(db._select_one('ai_insights', user_id=user['id']))
