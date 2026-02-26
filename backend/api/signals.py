from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier

router = APIRouter(prefix='/api/signals', tags=['signals'])


@router.get('/pending')
def pending(user: dict = Depends(get_current_user)):
    signals = db.get_pending_signals(user['id'], active_only=True)
    if user.get('subscription_tier', 'free') == 'free':
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
        filtered = []
        for s in signals:
            created = s.get('created_at') or datetime.now(timezone.utc).isoformat()
            ts = datetime.fromisoformat(str(created).replace('Z', '+00:00'))
            if ts <= cutoff:
                filtered.append(s)
        signals = filtered
    return ok(signals)


@router.post('/{signal_id}/dismiss')
def dismiss(signal_id: int, user: dict = Depends(get_current_user)):
    db.dismiss_signal(signal_id, user['id'])
    return ok({'id': signal_id, 'status': 'dismissed'})


@router.post('/{signal_id}/execute-live')
def execute_live(signal_id: int, user: dict = Depends(require_tier('pro'))):
    return ok({'signal_id': signal_id, 'mode': 'live', 'executed': True, 'user_id': user['id']})


@router.post('/{signal_id}/execute-demo')
def execute_demo(signal_id: int, user: dict = Depends(get_current_user)):
    return ok({'signal_id': signal_id, 'mode': 'demo', 'executed': True, 'user_id': user['id']})
