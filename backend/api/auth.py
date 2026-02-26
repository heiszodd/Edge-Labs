from __future__ import annotations

import re
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


def _safe_username(source: str, fallback_suffix: str) -> str:
    prefix = source.split("@")[0]
    base = re.sub(r"[^a-zA-Z0-9_]", "_", prefix).strip("_").lower()[:20]
    if not base:
        base = "user"
    return f"{base}_{fallback_suffix[:6]}"


def _ensure_user_row(user_id: str, email: str, username: str | None = None) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    email_clean = str(email).strip().lower()
    existing = db.get_user_by_id(user_id)
    if existing:
        updates = {"email": email_clean, "last_seen": now}
        if username and not existing.get("username"):
            updates["username"] = username
        db.update_user(user_id, updates)
        return db.get_user_by_id(user_id) or existing

    chosen_username = (username or "").strip() or _safe_username(email_clean, user_id.replace("-", ""))
    created = db._insert(
        "users",
        {
            "id": user_id,
            "email": email_clean,
            "username": chosen_username,
            "subscription_tier": "free",
            "subscription_status": "active",
            "role": "user",
            "is_admin": False,
            "last_seen": now,
        },
    )
    if not created:
        created = db._upsert(
            "users",
            {
                "id": user_id,
                "email": email_clean,
                "username": chosen_username,
                "subscription_tier": "free",
                "subscription_status": "active",
                "role": "user",
                "is_admin": False,
                "last_seen": now,
            },
            on_conflict="id",
        )
    db.create_user_defaults(user_id)
    return created or db.get_user_by_id(user_id)


def _auth_payload_for_user(user: dict, token: str) -> dict:
    return {
        "token": token,
        "user": {
            "id": user.get("id"),
            "email": user.get("email"),
            "username": user.get("username"),
            "subscription_tier": user.get("subscription_tier", "free"),
            "subscription_status": user.get("subscription_status", "active"),
            "role": user.get("role", "user"),
            "is_admin": bool(user.get("is_admin", False)),
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
        email = getattr(user_obj, "email", None) or body.email
        token = getattr(session_obj, "access_token", None)
        if not user_id:
            raise HTTPException(status_code=400, detail="Registration failed")
        user = _ensure_user_row(user_id, str(email), body.username)
        if not user:
            raise HTTPException(status_code=400, detail="Unable to create user row")
        if not token:
            return {
                "requires_email_verification": True,
                "message": "Account created. Verify your email, then sign in.",
            }
        return _auth_payload_for_user(user, token)
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
        email = getattr(user_obj, "email", None) or body.email
        token = getattr(session_obj, "access_token", None)
        if not user_id or not token:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        user = _ensure_user_row(user_id, str(email))
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
        "role": user.get("role", "user"),
        "is_admin": bool(user.get("is_admin", False)),
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
