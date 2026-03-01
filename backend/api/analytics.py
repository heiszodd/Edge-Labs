from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier
from engine.ai_analyzer import analyze_missed_setups, generate_trade_insights

router = APIRouter(prefix='/api/analytics', tags=['analytics'])


def _to_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return float(default)


@router.get('/performance')
def performance(section: str = 'all', period: str = '30d', user: dict = Depends(get_current_user)):
    trades = db.get_hl_trade_history(user['id'], limit=400)
    if section != 'all':
        trades = [trade for trade in trades if trade.get('section', 'perps') == section]

    pnls = [_to_float(trade.get('pnl', 0)) for trade in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    rolling = []
    for idx in range(len(pnls)):
        subset = pnls[max(0, idx - 19):idx + 1]
        subset_wins = len([item for item in subset if item > 0])
        rolling.append({'idx': idx + 1, 'win_rate': round((subset_wins / max(len(subset), 1)) * 100, 2)})

    payload = {
        'section': section,
        'period': period,
        'total_trades': len(trades),
        'win_rate': round((len(wins) / max(len(pnls), 1)) * 100, 2),
        'total_pnl': round(sum(pnls), 2),
        'avg_rr': round((abs(sum(wins)) / max(abs(sum(losses)), 1.0)), 2) if pnls else 0,
        'best_trade': max(pnls) if pnls else 0,
        'worst_trade': min(pnls) if pnls else 0,
        'winrate_series': rolling,
    }
    return ok(payload)


@router.get('/trade-history')
def trade_history(user: dict = Depends(get_current_user)):
    return ok({'perps': db.get_hl_trade_history(user['id']), 'degen': db._select_many('sol_positions', user_id=user['id'], status='closed'), 'predictions': db._select_many('poly_live_trades', user_id=user['id'], status='closed')})


@router.post('/ai-insights')
def ai_insights_start(payload: dict | None = None, user: dict = Depends(require_tier('premium'))):
    body = payload or {}
    insight = asyncio.run(generate_trade_insights(user['id'], period=body.get('period', 'weekly'), section=body.get('section', 'all')))
    missed = asyncio.run(analyze_missed_setups(user['id']))
    db._upsert('ai_insights', {**insight, 'missed_setups': missed, 'user_id': user['id']}, on_conflict='user_id')
    return ok({'job_id': f"ins-{user['id']}", 'insight': insight, 'missed_setups': missed})


@router.get('/ai-insights')
def ai_insights_get(user: dict = Depends(require_tier('premium'))):
    return ok(db._select_one('ai_insights', user_id=user['id']))
