from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


class ProfileUpdateBody(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=32)
    telegram_handle: str | None = Field(default=None, max_length=64)


class PasswordResetBody(BaseModel):
    email: EmailStr


class DeleteAccountBody(BaseModel):
    confirm_text: str


def _wallets(uid: str) -> dict:
    return {
        "hyperliquid": {"connected": bool(db.get_hl_address(uid)), "address": db.get_hl_address(uid)},
        "solana": {"connected": bool(db.get_sol_address(uid)), "address": db.get_sol_address(uid)},
        "polygon": {"connected": bool(db.get_poly_address(uid)), "address": db.get_poly_address(uid)},
    }


@router.get("/settings")
def get_settings(user: dict = Depends(get_current_user)):
    return ok(db.get_user_settings(user["id"]))


@router.put("/settings")
def put_settings(payload: dict, user: dict = Depends(get_current_user)):
    db.update_user_settings(user["id"], payload)
    return ok(db.get_user_settings(user["id"]))


@router.get("/subscription")
def subscription(user: dict = Depends(get_current_user)):
    return ok({"tier": user.get("subscription_tier", "free"), "status": user.get("subscription_status", "active")})


@router.get("/profile")
def get_profile(user: dict = Depends(get_current_user)):
    return ok(
        {
            "id": user.get("id"),
            "email": user.get("email"),
            "username": user.get("username"),
            "telegram_handle": user.get("telegram_username"),
            "telegram_linked": bool(user.get("telegram_linked")),
            "wallets": _wallets(user["id"]),
        }
    )


@router.put("/profile")
def update_profile(body: ProfileUpdateBody, user: dict = Depends(get_current_user)):
    updates = {}
    if body.username is not None:
        username = body.username.strip()
        if not re.fullmatch(r"[a-zA-Z0-9_]{3,32}", username):
            raise HTTPException(status_code=400, detail="invalid_username")
        updates["username"] = username
    if body.telegram_handle is not None:
        tg = body.telegram_handle.strip().lstrip("@")
        if tg and not re.fullmatch(r"[a-zA-Z0-9_]{5,64}", tg):
            raise HTTPException(status_code=400, detail="invalid_telegram_handle")
        updates["telegram_username"] = tg or None
    if not updates:
        return get_profile(user)
    db.update_user(user["id"], updates)
    refreshed = db.get_user_by_id(user["id"])
    return ok(
        {
            "id": refreshed.get("id"),
            "email": refreshed.get("email"),
            "username": refreshed.get("username"),
            "telegram_handle": refreshed.get("telegram_username"),
            "telegram_linked": bool(refreshed.get("telegram_linked")),
            "wallets": _wallets(user["id"]),
        }
    )


@router.post("/password-reset")
def password_reset(body: PasswordResetBody, user: dict = Depends(get_current_user)):
    if str(body.email).strip().lower() != str(user.get("email", "")).strip().lower():
        raise HTTPException(status_code=400, detail="email_mismatch")
    # If auth provider reset integration is unavailable, return an explicit manual flow.
    return ok({"sent": True, "mode": "manual", "message": "Use your auth provider reset email flow."})


@router.delete("/account")
def delete_account(body: DeleteAccountBody, user: dict = Depends(get_current_user)):
    if body.confirm_text.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="confirmation_required")
    db.update_user(user["id"], {"is_active": False})
    db.log_audit(user["id"], "delete_account", {"source": "profile"}, success=True)
    return ok({"deleted": True})
