from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user
from backend.security.key_manager import store_private_key

router = APIRouter(prefix="/api/wallets", tags=["wallets"])


class ConnectBody(BaseModel):
    chain: str
    raw_key_or_seed: str | None = None
    wallet_address: str | None = None


def _short(address: str) -> str:
    return address[:10] if address else ""


def _validate_address(chain: str, address: str) -> str:
    value = (address or "").strip()
    if not value:
        return ""
    if chain == "hl":
        if value.startswith("0x") is False:
            value = f"0x{value}"
        if not re.fullmatch(r"0x[a-fA-F0-9]{40}", value):
            raise HTTPException(status_code=400, detail="Invalid Hyperliquid wallet address format")
    elif chain == "sol":
        if not re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{32,44}", value):
            raise HTTPException(status_code=400, detail="Invalid Solana wallet address format")
    elif chain == "poly":
        if not re.fullmatch(r"0x[a-fA-F0-9]{40}", value):
            raise HTTPException(status_code=400, detail="Invalid Polygon wallet address format")
    return value


@router.get("/status")
def status(user: dict = Depends(get_current_user)):
    uid = user["id"]
    hl = db.get_hl_address(uid)
    sol = db.get_sol_address(uid)
    poly = db.get_poly_address(uid)
    return ok(
        {
            "perps": {"connected": bool(hl), "address": _short(hl), "chain": "hyperliquid"},
            "degen": {"connected": bool(sol), "address": _short(sol), "chain": "solana"},
            "predictions": {"connected": bool(poly), "address": _short(poly), "chain": "polygon"},
        }
    )


@router.post("/connect")
def connect(body: ConnectBody, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    chain = str(body.chain or "").strip().lower()
    if chain not in {"hl", "sol", "poly"}:
        raise HTTPException(status_code=400, detail="Unsupported chain")

    raw_key = (body.raw_key_or_seed or "").strip()
    address = _validate_address(chain, (body.wallet_address or "").strip())

    if chain == "hl" and raw_key:
        try:
            from eth_account import Account

            derived = Account.from_key(raw_key).address
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid private key: {exc}") from exc
        if not derived.startswith("0x") or len(derived) != 42:
            raise HTTPException(status_code=400, detail="Could not derive valid address")
        address = derived

    if not address and not raw_key:
        raise HTTPException(status_code=400, detail="Provide wallet address or private key")

    if raw_key:
        key_name = f"{chain}_pk"
        # Keep legacy helper, but force the authoritative address from validated input/derivation.
        store_private_key(user_id, key_name, raw_key, f"{chain} key", chain)

    if address:
        if chain == "hl":
            db.save_hl_address(user_id, address)
        elif chain == "sol":
            db.save_sol_address(user_id, address)
        else:
            db.save_poly_address(user_id, address)

    return ok({"success": True, "chain": chain, "address": address})


@router.delete("/{chain}")
def disconnect(chain: str, user: dict = Depends(get_current_user)):
    chain_key = str(chain or "").strip().lower()
    if chain_key not in {"hl", "sol", "poly"}:
        raise HTTPException(status_code=400, detail="Unsupported chain")
    db._delete("encrypted_keys", user_id=user["id"], key_name=f"{chain_key}_pk")
    db._delete("encrypted_keys", user_id=user["id"], key_name=f"{chain_key}_address")
    if chain_key == "hl":
        db._delete("encrypted_keys", user_id=user["id"], key_name="hl_address")
    elif chain_key == "sol":
        db._delete("encrypted_keys", user_id=user["id"], key_name="sol_address")
    else:
        db._delete("encrypted_keys", user_id=user["id"], key_name="poly_address")
    return ok({"chain": chain_key, "disconnected": True})
