from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr

from backend import config, db
from backend.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    username: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class TelegramVerifyBody(BaseModel):
    token: str
    telegram_user_id: int
    telegram_username: str | None = None


def _auth_payload_for_user(user: dict, token: str) -> dict:
    return {
        "token": token,
        "user": {
            "id": user.get("id"),
            "email": user.get("email"),
            "username": user.get("username"),
            "subscription_tier": user.get("subscription_tier", "free"),
            "telegram_linked": bool(user.get("telegram_linked")),
        },
    }


@router.post("/register")
def register(body: RegisterBody) -> dict:
    if not db._client:
        raise HTTPException(status_code=500, detail="Auth unavailable")
    try:
        auth_res = db._client.auth.sign_up({"email": body.email, "password": body.password})
        user_obj = getattr(auth_res, "user", None)
        session_obj = getattr(auth_res, "session", None)
        user_id = getattr(user_obj, "id", None)
        token = getattr(session_obj, "access_token", None)
        if not user_id or not token:
            raise HTTPException(status_code=400, detail="Registration failed")

        created = db._insert(
            "users",
            {
                "id": user_id,
                "email": body.email,
                "username": body.username,
                "subscription_tier": "free",
                "subscription_status": "active",
                "last_seen": datetime.now(timezone.utc).isoformat(),
            },
        )
        if not created:
            raise HTTPException(status_code=400, detail="Unable to create user row")
        db.create_user_defaults(user_id)
        return _auth_payload_for_user(created, token)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Registration failed: {exc}")


@router.post("/login")
def login(body: LoginBody) -> dict:
    if not db._client:
        raise HTTPException(status_code=500, detail="Auth unavailable")
    try:
        auth_res = db._client.auth.sign_in_with_password({"email": body.email, "password": body.password})
        user_obj = getattr(auth_res, "user", None)
        session_obj = getattr(auth_res, "session", None)
        user_id = getattr(user_obj, "id", None)
        token = getattr(session_obj, "access_token", None)
        if not user_id or not token:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        db.update_user(user_id, {"last_seen": datetime.now(timezone.utc).isoformat()})
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return _auth_payload_for_user(user, token)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid credentials: {exc}")


@router.get("/me")
def me(user: dict = Depends(get_current_user)) -> dict:
    tier = str(user.get("subscription_tier", "free")).lower()
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "username": user.get("username"),
        "subscription_tier": tier,
        "subscription_status": user.get("subscription_status", "active"),
        "tier": tier,
        "telegram_linked": bool(user.get("telegram_linked")),
    }


@router.post("/telegram-link")
def telegram_link(user: dict = Depends(get_current_user)) -> dict:
    alphabet = string.ascii_uppercase + string.digits
    token = "".join(secrets.choice(alphabet) for _ in range(8))
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.update_user(
        user.get("id"),
        {
            "telegram_link_token": token,
            "telegram_link_expires": expires.isoformat(),
        },
    )
    return {"token": token}


@router.post("/telegram-verify")
def telegram_verify(body: TelegramVerifyBody, x_service_key: str | None = Header(default=None, alias="X-Service-Key")) -> dict:
    if not config.SERVICE_SECRET or x_service_key != config.SERVICE_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service key")
    user = db.get_user_by_link_token(body.token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")
    expires_raw = user.get("telegram_link_expires")
    if not expires_raw:
        raise HTTPException(status_code=400, detail="Expired token")
    try:
        expires = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Expired token")
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Expired token")
    db.update_user(
        user.get("id"),
        {
            "telegram_user_id": body.telegram_user_id,
            "telegram_username": body.telegram_username,
            "telegram_linked": True,
            "telegram_link_token": None,
            "telegram_link_expires": None,
        },
    )
    return {"success": True}
