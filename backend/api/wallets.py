from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user
from backend.security.key_manager import store_private_key

router = APIRouter(prefix='/api/wallets', tags=['wallets'])


class ConnectBody(BaseModel):
    chain: str
    raw_key_or_seed: str


@router.get('/status')
def status(user: dict = Depends(get_current_user)):
    uid = user['id']
    return ok({
        'perps': {'connected': bool(db.get_hl_address(uid)), 'address': db.get_hl_address(uid)[:10], 'chain': 'hyperliquid'},
        'degen': {'connected': bool(db.get_sol_address(uid)), 'address': db.get_sol_address(uid)[:10], 'chain': 'solana'},
        'predictions': {'connected': bool(db.get_poly_address(uid)), 'address': db.get_poly_address(uid)[:10], 'chain': 'polygon'},
    })


@router.post('/connect')
def connect(body: ConnectBody, user: dict = Depends(get_current_user)):
    key_name = f"{body.chain}_pk"
    saved = store_private_key(user['id'], key_name, body.raw_key_or_seed, f"{body.chain} key", body.chain)
    db.save_encrypted_key(user['id'], f"{body.chain}_address", saved['address'], f"{body.chain} address")
    return ok(saved)


@router.delete('/{chain}')
def disconnect(chain: str, user: dict = Depends(get_current_user)):
    db._delete('encrypted_keys', user_id=user['id'], key_name=f'{chain}_pk')
    db._delete('encrypted_keys', user_id=user['id'], key_name=f'{chain}_address')
    return ok({'chain': chain, 'disconnected': True})
