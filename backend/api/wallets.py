from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user
from backend.security.key_manager import store_private_key

router = APIRouter(prefix='/api/wallets', tags=['wallets'])


class ConnectBody(BaseModel):
    chain: str
    raw_key_or_seed: str | None = None
    wallet_address: str | None = None


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
    chain = str(body.chain or "").strip().lower()
    if chain not in {"hl", "sol", "poly"}:
        raise HTTPException(status_code=400, detail="Unsupported chain")
    key_name = f"{chain}_pk"
    address = (body.wallet_address or "").strip()
    raw_key = (body.raw_key_or_seed or "").strip()
    saved = {"address": address, "format": "address_only"} if address else None
    if raw_key:
        saved = store_private_key(user['id'], key_name, raw_key, f"{chain} key", chain)
        if address:
            saved["address"] = address
    if chain == "hl":
        derived = str((saved or {}).get("address") or "")
        if not address and (not derived.startswith("0x") or len(derived) != 42):
            raise HTTPException(status_code=400, detail="Hyperliquid requires a valid wallet address")
    if saved and saved.get("address"):
        db.save_encrypted_key(user['id'], f"{chain}_address", saved['address'], f"{chain} address")
    return ok(saved or {"address": "", "format": "none"})


@router.delete('/{chain}')
def disconnect(chain: str, user: dict = Depends(get_current_user)):
    db._delete('encrypted_keys', user_id=user['id'], key_name=f'{chain}_pk')
    db._delete('encrypted_keys', user_id=user['id'], key_name=f'{chain}_address')
    return ok({'chain': chain, 'disconnected': True})
    if address:
        if chain == "hl" and not re.fullmatch(r"0x[a-fA-F0-9]{40}", address):
            raise HTTPException(status_code=400, detail="Invalid Hyperliquid wallet address format")
        if chain == "sol" and not re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{32,44}", address):
            raise HTTPException(status_code=400, detail="Invalid Solana wallet address format")
        if chain == "poly" and not re.fullmatch(r"0x[a-fA-F0-9]{40}", address):
            raise HTTPException(status_code=400, detail="Invalid Polygon wallet address format")
