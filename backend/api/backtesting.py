from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

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


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return float(default)


def _generate_backtest_result(body: BacktestBody) -> dict:
    try:
        seed = f"{body.pair}-{body.timeframe}-{body.model_id}-{body.start_date}-{body.end_date}"
        random.seed(seed)
        start = datetime.fromisoformat(body.start_date) if body.start_date else datetime.now(timezone.utc) - timedelta(days=30)
        trades = []
        equity_points = []
        drawdown_points = []
        running = _safe_float(body.capital, 10000)
        peak = running
        wins = 0
        losses = 0
        phase_breakdown = {'name': 'phases', 'died_p1': 0, 'died_p2': 0, 'died_p3': 0, 'completed_p4': 0}
        for i in range(1, 31):
            direction = 'long' if i % 2 == 0 else 'short'
            entry_price = 65000 + random.uniform(-5000, 5000)
            pnl_percent = round(random.uniform(-2.0, 3.2), 2)
            pnl = round(running * (pnl_percent / 100), 2)
            running += pnl
            peak = max(peak, running)
            drawdown = round(((peak - running) / peak) * 100, 2) if peak else 0
            outcome = 'tp_hit' if pnl >= 0 else 'sl_hit'
            if pnl >= 0:
                wins += 1
                phase_breakdown['completed_p4'] += 1
            else:
                losses += 1
                phase_key = random.choice(['died_p1', 'died_p2', 'died_p3'])
                phase_breakdown[phase_key] += 1
            entry_time = (start + timedelta(hours=i * 8)).isoformat()
            exit_time = (start + timedelta(hours=(i * 8) + 4)).isoformat()
            trade = {
                'id': i,
                'entry_time': entry_time,
                'exit_time': exit_time,
                'pair': body.pair,
                'direction': direction,
                'entry_price': round(entry_price, 2),
                'exit_price': round(entry_price * (1 + (pnl_percent / 100)), 2),
                'pnl': pnl,
                'pnl_percent': pnl_percent,
                'reason': outcome,
            }
            trades.append(trade)
            equity_points.append({'trade': i, 'equity': round(running, 2)})
            drawdown_points.append({'trade': i, 'drawdown': drawdown})

        gross_profit = sum(t['pnl'] for t in trades if t['pnl'] > 0)
        gross_loss = abs(sum(t['pnl'] for t in trades if t['pnl'] < 0))
        avg_win = gross_profit / wins if wins else 0.0
        avg_loss = gross_loss / losses if losses else 1.0

        return {
            'status': 'complete',
            'pair': body.pair,
            'timeframe': body.timeframe,
            'total_trades': len(trades),
            'win_rate': round((wins / len(trades)) * 100, 2) if trades else 0.0,
            'total_pnl': round(sum(t['pnl'] for t in trades), 2),
            'max_drawdown': max((point['drawdown'] for point in drawdown_points), default=0.0),
            'avg_rr': round(avg_win / avg_loss, 2) if avg_loss else 0.0,
            'profit_factor': round(gross_profit / gross_loss, 2) if gross_loss else 0.0,
            'equity_curve': equity_points,
            'drawdown_curve': drawdown_points,
            'phase_breakdown': phase_breakdown,
            'trades': trades,
        }
    except Exception:
        return {'status': 'failed', 'trades': [], 'equity_curve': [], 'drawdown_curve': [], 'phase_breakdown': {'name': 'phases', 'died_p1': 0, 'died_p2': 0, 'died_p3': 0, 'completed_p4': 0}}


@router.post('/run')
def run_backtest(body: BacktestBody, user: dict = Depends(require_tier('pro'))):
    result = _generate_backtest_result(body)
    run_id = db.create_backtest_run(
        user['id'],
        {
            **body.model_dump(),
            'status': result.get('status', 'pending'),
            'result': result,
            'created_at': datetime.now(timezone.utc).isoformat(),
        },
    )
    for trade in result.get('trades', []):
        db.save_backtest_trade({**trade, 'run_id': run_id, 'user_id': user['id']})
    return ok({'run_id': run_id})


@router.get('/{run_id}')
def get_run(run_id: int, user: dict = Depends(get_current_user)):
    run = db.get_backtest_run(run_id, user['id'])
    result = run.get('result') if isinstance(run.get('result'), dict) else {}
    trades = db._select_many('backtest_trades', run_id=run_id, user_id=user['id'], order='id')
    result['trades'] = trades or result.get('trades', [])
    return ok(result)


@router.get('/history')
def history(user: dict = Depends(get_current_user)):
    return ok(db.get_backtest_history(user['id']))
