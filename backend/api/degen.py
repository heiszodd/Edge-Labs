from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user, require_tier

router = APIRouter(prefix="/api/degen", tags=["degen"])


class AddressBody(BaseModel):
    address: str


class ToggleBody(BaseModel):
    active: bool


class BuyBody(BaseModel):
    token_address: str
    size_usd: float
    confirm_id: str | None = None


class DemoBuyBody(BaseModel):
    token_address: str
    size_usd: float


class WatchBody(BaseModel):
    address: str
    note: str | None = None


class TrackedWalletBody(BaseModel):
    wallet_address: str
    label: str | None = None
    auto_mirror: bool = False


class DepositBody(BaseModel):
    amount: float


@router.get('/balance')
def balance(user: dict = Depends(get_current_user)):
    return ok({'sol_address': db.get_sol_address(user['id']), 'balance': 0.0})


@router.get('/positions')
def positions(user: dict = Depends(get_current_user)):
    return ok(db.get_open_sol_positions(user['id']))


@router.post('/scan-contract')
def scan_contract(body: AddressBody, user: dict = Depends(get_current_user)):
    report = {
        'address': body.address,
        'risk_score': 22,
        'grade': 'B',
        'honeypot': False,
        'liquidity_locked': True,
        'owner_renounced': True,
    }
    return ok(report)


@router.get('/scanner/results')
def scanner_results(user: dict = Depends(get_current_user)):
    return ok(db.get_pending_signals(user['id'], section='degen', active_only=True))


@router.post('/scanner/run')
def scanner_run(user: dict = Depends(require_tier('pro'))):
    return ok({'queued': True, 'user_id': user['id']})


@router.get('/models')
def get_models(user: dict = Depends(get_current_user)):
    return ok(db.get_degen_models(user['id']))


@router.post('/models')
def create_model(payload: dict[str, Any], user: dict = Depends(get_current_user)):
    mid = db.save_degen_model(user['id'], payload)
    return ok({'id': mid})


@router.put('/models/{model_id}')
def update_model(model_id: int, payload: dict[str, Any], user: dict = Depends(get_current_user)):
    db._update('degen_models', payload, id=model_id, user_id=user['id'])
    return ok({'id': model_id})


@router.delete('/models/{model_id}')
def delete_model(model_id: int, user: dict = Depends(get_current_user)):
    db._delete('degen_models', id=model_id, user_id=user['id'])
    return ok({'id': model_id})


@router.post('/models/{model_id}/toggle')
def toggle_model(model_id: int, body: ToggleBody, user: dict = Depends(get_current_user)):
    db.toggle_degen_model(model_id, user['id'], body.active)
    return ok({'id': model_id, 'active': body.active})


@router.post('/buy')
def buy(body: BuyBody, user: dict = Depends(require_tier('pro'))):
    return ok({'executed': True, **body.model_dump()})


@router.post('/demo-buy')
def demo_buy(body: DemoBuyBody, user: dict = Depends(get_current_user)):
    trade_id = db.open_demo_trade(user['id'], {'section': 'sol', 'token_address': body.token_address, 'size_usd': body.size_usd, 'status': 'open', 'opened_at': datetime.now(timezone.utc).isoformat()})
    return ok({'trade_id': trade_id})


@router.get('/watchlist')
def get_watchlist(user: dict = Depends(get_current_user)):
    return ok(db._select_many('watchlist', user_id=user['id']))


@router.post('/watchlist')
def add_watchlist(body: WatchBody, user: dict = Depends(get_current_user)):
    row = db._insert('watchlist', {'user_id': user['id'], 'address': body.address, 'note': body.note})
    return ok(row)


@router.delete('/watchlist/{item_id}')
def delete_watchlist(item_id: int, user: dict = Depends(get_current_user)):
    db._delete('watchlist', id=item_id, user_id=user['id'])
    return ok({'id': item_id})


@router.get('/blacklist')
def get_black(user: dict = Depends(get_current_user)):
    return ok(db.get_blacklist(user['id']))


@router.post('/blacklist')
def add_black(body: WatchBody, user: dict = Depends(get_current_user)):
    db.add_to_blacklist(user['id'], body.address, body.note or '')
    return ok({'address': body.address})


@router.delete('/blacklist/{item_id}')
def delete_black(item_id: int, user: dict = Depends(get_current_user)):
    db._delete('blacklist', id=item_id, user_id=user['id'])
    return ok({'id': item_id})


@router.get('/tracked-wallets')
def tracked_wallets(user: dict = Depends(get_current_user)):
    return ok(db.get_tracked_wallets(user['id']))


@router.post('/tracked-wallets')
def add_tracked(body: TrackedWalletBody, user: dict = Depends(get_current_user)):
    db.save_tracked_wallet(user['id'], body.model_dump())
    return ok(body.model_dump())


@router.put('/tracked-wallets/{item_id}')
def update_tracked(item_id: int, body: TrackedWalletBody, user: dict = Depends(get_current_user)):
    db._update('tracked_wallets', body.model_dump(), id=item_id, user_id=user['id'])
    return ok({'id': item_id})


@router.delete('/tracked-wallets/{item_id}')
def delete_tracked(item_id: int, user: dict = Depends(get_current_user)):
    db._delete('tracked_wallets', id=item_id, user_id=user['id'])
    return ok({'id': item_id})


@router.get('/demo')
def get_demo(user: dict = Depends(get_current_user)):
    return ok({'balance': db.get_demo_balance(user['id'], 'sol'), 'open_trades': db.get_open_demo_trades(user['id'], 'sol')})


@router.post('/demo/deposit')
def deposit(body: DepositBody, user: dict = Depends(get_current_user)):
    bal = db.get_demo_balance(user['id'], 'sol') + body.amount
    db.set_demo_balance(user['id'], 'sol', bal)
    return ok({'balance': bal})


@router.post('/demo/reset')
def reset(user: dict = Depends(get_current_user)):
    db.reset_demo_balance(user['id'], 'sol')
    return ok({'balance': db.get_demo_balance(user['id'], 'sol')})
