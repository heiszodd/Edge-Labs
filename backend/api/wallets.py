from __future__ import annotations

import base64
import binascii
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user

router = APIRouter(prefix="/api/wallets", tags=["wallets"])


class ConnectBody(BaseModel):
    chain: str
    raw_key_or_seed: str | None = None
    wallet_address: str | None = None
    verified: bool = False


class ChallengeBody(BaseModel):
    chain: str
    wallet_address: str
    chain_id: int | None = None


class VerifyBody(BaseModel):
    chain: str
    wallet_address: str
    nonce: str
    signature: str
    chain_id: int | None = None
    signature_encoding: str = "hex"  # hex | base64


def _short(address: str) -> str:
    if not address:
        return ""
    return f"{address[:6]}...{address[-4:]}"


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


def _verify_evm_signature(address: str, message: str, signature: str) -> bool:
    try:
        from eth_account import Account
        from eth_account.messages import encode_defunct
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"evm_verifier_unavailable:{exc}") from exc
    try:
        recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
        return str(recovered or "").lower() == str(address or "").lower()
    except Exception:
        return False


_BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58decode(value: str) -> bytes:
    num = 0
    for char in value:
        idx = _BASE58_ALPHABET.find(char)
        if idx == -1:
            raise ValueError("invalid base58")
        num = num * 58 + idx
    combined = num.to_bytes((num.bit_length() + 7) // 8, byteorder="big")
    pad = len(value) - len(value.lstrip("1"))
    return b"\x00" * pad + combined


def _decode_signature(signature: str, encoding: str) -> bytes:
    mode = str(encoding or "hex").lower()
    if mode == "base64":
        return base64.b64decode(signature)
    if mode == "hex":
        text = signature[2:] if signature.startswith("0x") else signature
        return bytes.fromhex(text)
    raise HTTPException(status_code=400, detail="unsupported_signature_encoding")


def _verify_solana_signature(address: str, message: str, signature: str, encoding: str) -> bool:
    try:
        from nacl.signing import VerifyKey
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"solana_verifier_unavailable:{exc}") from exc
    try:
        pubkey = _b58decode(address)
        sig = _decode_signature(signature, encoding)
        VerifyKey(pubkey).verify(message.encode("utf-8"), sig)
        return True
    except (ValueError, binascii.Error):
        return False
    except Exception:
        return False


def _challenge_message(chain: str, address: str, nonce: str, expires_at: str, chain_id: int | None) -> str:
    lines = [
        "Edge-Lab wallet verification",
        f"Chain: {chain}",
        f"Address: {address}",
        f"Nonce: {nonce}",
        f"ExpiresAt: {expires_at}",
    ]
    if chain_id is not None:
        lines.append(f"ChainId: {chain_id}")
    return "\n".join(lines)


def _chain_status(user_id: str, chain: str, label: str) -> dict:
    if chain == "hl":
        address = db.get_hl_address(user_id)
    elif chain == "sol":
        address = db.get_sol_address(user_id)
    else:
        address = db.get_poly_address(user_id)
    meta = db.get_wallet_verification(user_id, chain)
    verified = bool(meta.get("verified")) if meta else False
    return {
        "connected": bool(address),
        "address": _short(address),
        "full_address": address or "",
        "chain": label,
        "verified": verified,
        "verification_method": meta.get("method") if isinstance(meta, dict) else None,
        "verified_at": meta.get("verified_at") if isinstance(meta, dict) else None,
    }


@router.get("/status")
def status(user: dict = Depends(get_current_user)):
    uid = user["id"]
    return ok(
        {
            "perps": _chain_status(uid, "hl", "hyperliquid"),
            "degen": _chain_status(uid, "sol", "solana"),
            "predictions": _chain_status(uid, "poly", "polygon"),
        }
    )


@router.post("/challenge")
def challenge(body: ChallengeBody, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    chain = str(body.chain or "").strip().lower()
    if chain not in {"hl", "sol", "poly"}:
        raise HTTPException(status_code=400, detail="unsupported_chain")
    address = _validate_address(chain, body.wallet_address)
    if not address:
        raise HTTPException(status_code=400, detail="wallet_address_required")

    nonce = secrets.token_urlsafe(18)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    message = _challenge_message(chain, address, nonce, expires_at, body.chain_id)
    db.save_wallet_challenge(
        user_id,
        chain,
        {
            "address": address,
            "nonce": nonce,
            "chain_id": body.chain_id,
            "expires_at": expires_at,
            "message": message,
            "issued_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return ok({"chain": chain, "address": address, "nonce": nonce, "message": message, "expires_at": expires_at})


@router.post("/verify")
def verify(body: VerifyBody, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    chain = str(body.chain or "").strip().lower()
    if chain not in {"hl", "sol", "poly"}:
        raise HTTPException(status_code=400, detail="unsupported_chain")

    address = _validate_address(chain, body.wallet_address)
    challenge_data = db.get_wallet_challenge(user_id, chain)
    if not challenge_data:
        raise HTTPException(status_code=400, detail="challenge_not_found")

    expected_nonce = str(challenge_data.get("nonce") or "")
    expected_address = str(challenge_data.get("address") or "")
    expires_at = str(challenge_data.get("expires_at") or "")
    challenge_chain_id = challenge_data.get("chain_id")
    message = str(challenge_data.get("message") or "")
    if not message or not expected_nonce:
        raise HTTPException(status_code=400, detail="invalid_challenge")
    if expected_nonce != str(body.nonce):
        raise HTTPException(status_code=400, detail="nonce_mismatch")
    if expected_address.lower() != address.lower():
        raise HTTPException(status_code=400, detail="address_mismatch")
    try:
        if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="challenge_expired")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="challenge_expired")
    if challenge_chain_id is not None and body.chain_id is not None and int(challenge_chain_id) != int(body.chain_id):
        raise HTTPException(status_code=400, detail="chain_id_mismatch")

    if chain in {"hl", "poly"}:
        valid = _verify_evm_signature(address, message, body.signature)
    else:
        valid = _verify_solana_signature(address, message, body.signature, body.signature_encoding)
    if not valid:
        raise HTTPException(status_code=400, detail="signature_verification_failed")

    if chain == "hl":
        db.save_hl_address(user_id, address)
    elif chain == "sol":
        db.save_sol_address(user_id, address)
    else:
        db.save_poly_address(user_id, address)

    db.save_wallet_verification(
        user_id,
        chain,
        {
            "verified": True,
            "method": "signature",
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "address": address,
            "chain_id": body.chain_id,
        },
    )
    db.clear_wallet_challenge(user_id, chain)
    return ok({"success": True, "chain": chain, "address": address, "verified": True})


@router.post("/connect")
def connect(body: ConnectBody, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    chain = str(body.chain or "").strip().lower()
    if chain not in {"hl", "sol", "poly"}:
        raise HTTPException(status_code=400, detail="unsupported_chain")
    address = _validate_address(chain, (body.wallet_address or "").strip())
    if not address:
        raise HTTPException(status_code=400, detail="wallet_address_required")
    if body.raw_key_or_seed:
        raise HTTPException(status_code=400, detail="private_key_import_disabled")

    if address:
        if chain == "hl":
            db.save_hl_address(user_id, address)
        elif chain == "sol":
            db.save_sol_address(user_id, address)
        else:
            db.save_poly_address(user_id, address)
    db.save_wallet_verification(
        user_id,
        chain,
        {
            "verified": bool(body.verified),
            "method": "manual" if not body.verified else "signature",
            "verified_at": datetime.now(timezone.utc).isoformat() if body.verified else None,
            "address": address,
        },
    )

    return ok({"success": True, "chain": chain, "address": address, "verified": bool(body.verified)})


@router.delete("/{chain}")
def disconnect(chain: str, user: dict = Depends(get_current_user)):
    chain_key = str(chain or "").strip().lower()
    if chain_key not in {"hl", "sol", "poly"}:
        raise HTTPException(status_code=400, detail="unsupported_chain")
    db._delete("encrypted_keys", user_id=user["id"], key_name=f"{chain_key}_pk")
    db._delete("encrypted_keys", user_id=user["id"], key_name=f"{chain_key}_address")
    db._delete("encrypted_keys", user_id=user["id"], key_name=f"{chain_key}_wallet_meta")
    db._delete("encrypted_keys", user_id=user["id"], key_name=f"{chain_key}_wallet_challenge")
    if chain_key == "hl":
        db._delete("encrypted_keys", user_id=user["id"], key_name="hl_address")
    elif chain_key == "sol":
        db._delete("encrypted_keys", user_id=user["id"], key_name="sol_address")
    else:
        db._delete("encrypted_keys", user_id=user["id"], key_name="poly_address")
    return ok({"chain": chain_key, "disconnected": True})
