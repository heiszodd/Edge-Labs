from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier

router = APIRouter(prefix='/api/predictions', tags=['predictions'])


class ToggleBody(BaseModel):
    active: bool


class TradeBody(BaseModel):
    market_id: str | None = None
    signal_id: int | None = None
    size_usd: float = 0


class WatchBody(BaseModel):
    market: str


class DepositBody(BaseModel):
    amount: float


@router.get('/scanner')
def scanner(user: dict = Depends(get_current_user)):
    return ok([{'market': 'BTC > 100k by EOY', 'score': 76, 'grade': 'B'}])


@router.get('/models')
def models(user: dict = Depends(get_current_user)):
    return ok(db.get_prediction_models(user['id']))


@router.post('/models')
def create_model(payload: dict[str, Any], user: dict = Depends(get_current_user)):
    mid = db.save_prediction_model(user['id'], payload)
    return ok({'id': mid})


@router.put('/models/{model_id}')
def update_model(model_id: int, payload: dict[str, Any], user: dict = Depends(get_current_user)):
    db._update('prediction_models', payload, id=model_id, user_id=user['id'])
    return ok({'id': model_id})


@router.delete('/models/{model_id}')
def delete_model(model_id: int, user: dict = Depends(get_current_user)):
    db._delete('prediction_models', id=model_id, user_id=user['id'])
    return ok({'id': model_id})


@router.post('/models/{model_id}/toggle')
def toggle(model_id: int, body: ToggleBody, user: dict = Depends(get_current_user)):
    db.toggle_prediction_model(model_id, user['id'], body.active)
    return ok({'id': model_id, 'active': body.active})


@router.get('/trades')
def trades(user: dict = Depends(get_current_user)):
    return ok(db.get_open_poly_trades(user['id']))


@router.post('/trade')
def trade(body: TradeBody, user: dict = Depends(require_tier('pro'))):
    return ok({'executed': True, **body.model_dump()})


@router.post('/demo-trade')
def demo_trade(body: TradeBody, user: dict = Depends(get_current_user)):
    tid = db.open_demo_trade(user['id'], {'section': 'poly', 'market_id': body.market_id, 'size_usd': body.size_usd, 'status': 'open', 'opened_at': datetime.now(timezone.utc).isoformat()})
    return ok({'trade_id': tid})


@router.get('/watchlist')
def watchlist(user: dict = Depends(get_current_user)):
    return ok(db._select_many('prediction_watchlist', user_id=user['id']))


@router.post('/watchlist')
def add_watchlist(body: WatchBody, user: dict = Depends(get_current_user)):
    row = db._insert('prediction_watchlist', {'user_id': user['id'], 'market': body.market})
    return ok(row)


@router.delete('/watchlist/{item_id}')
def del_watch(item_id: int, user: dict = Depends(get_current_user)):
    db._delete('prediction_watchlist', id=item_id, user_id=user['id'])
    return ok({'id': item_id})


@router.get('/demo')
def demo(user: dict = Depends(get_current_user)):
    return ok({'balance': db.get_demo_balance(user['id'], 'poly'), 'open_trades': db.get_open_demo_trades(user['id'], 'poly')})


@router.post('/demo/deposit')
def deposit(body: DepositBody, user: dict = Depends(get_current_user)):
    bal = db.get_demo_balance(user['id'], 'poly') + body.amount
    db.set_demo_balance(user['id'], 'poly', bal)
    return ok({'balance': bal})


@router.post('/demo/reset')
def reset(user: dict = Depends(get_current_user)):
    db.reset_demo_balance(user['id'], 'poly')
    return ok({'balance': db.get_demo_balance(user['id'], 'poly')})
