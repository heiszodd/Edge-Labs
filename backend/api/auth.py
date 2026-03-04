from __future__ import annotations

import re
import secrets
import string
import hashlib
import hmac
import logging
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, EmailStr

from backend import config, db
from backend.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger(__name__)


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


class TelegramOAuthData(BaseModel):
    id: int
    first_name: str
    username: str = ""
    photo_url: str = ""
    auth_date: int
    hash: str


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
        row = db.get_user_by_id(user_id) or existing
        if config.AUTO_PROMOTE_FIRST_USER_ADMIN and row and not db.has_admin_user():
            db.update_user(user_id, {"role": "admin", "is_admin": True, "subscription_tier": "premium", "subscription_status": "active"})
            row = db.get_user_by_id(user_id) or row
        return row

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
    row = created or db.get_user_by_id(user_id)
    if config.AUTO_PROMOTE_FIRST_USER_ADMIN and row and not db.has_admin_user():
        db.update_user(user_id, {"role": "admin", "is_admin": True, "subscription_tier": "premium", "subscription_status": "active"})
        row = db.get_user_by_id(user_id) or row
    return row


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


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=config.AUTH_COOKIE_NAME,
        value=token,
        max_age=config.AUTH_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=config.AUTH_COOKIE_SECURE,
        samesite=config.AUTH_COOKIE_SAMESITE,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=config.AUTH_COOKIE_NAME,
        path="/",
        secure=config.AUTH_COOKIE_SECURE,
        samesite=config.AUTH_COOKIE_SAMESITE,
    )


@router.post("/register")
def register(body: RegisterBody, response: Response) -> dict:
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
        _set_auth_cookie(response, token)
        return _auth_payload_for_user(user, token)
    except HTTPException:
        raise
    except Exception as exc:
        msg = str(exc).lower()
        if "already registered" in msg or "already exists" in msg or "user already" in msg:
            try:
                login_res = db._client.auth.sign_in_with_password({"email": body.email, "password": body.password})
                user_obj = getattr(login_res, "user", None)
                session_obj = getattr(login_res, "session", None)
                user_id = getattr(user_obj, "id", None)
                token = getattr(session_obj, "access_token", None)
                if user_id and token:
                    user = _ensure_user_row(user_id, str(body.email), body.username)
                    if user:
                        _set_auth_cookie(response, token)
                        return _auth_payload_for_user(user, token)
            except Exception:
                pass
            raise HTTPException(status_code=400, detail="Email already registered. Try sign in.")
        raise HTTPException(status_code=400, detail=f"Registration failed: {exc}")


@router.post("/login")
def login(body: LoginBody, response: Response) -> dict:
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
        _set_auth_cookie(response, token)
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
        "telegram_username": user.get("telegram_username"),
        "telegram_link_expires": user.get("telegram_link_expires"),
    }


@router.post("/logout")
def logout(response: Response) -> dict:
    _clear_auth_cookie(response)
    return {"success": True}


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


@router.post("/telegram-unlink")
def telegram_unlink(user: dict = Depends(get_current_user)) -> dict:
    db.update_user(
        user.get("id"),
        {
            "telegram_user_id": None,
            "telegram_username": None,
            "telegram_linked": False,
            "telegram_link_token": None,
            "telegram_link_expires": None,
        },
    )
    return {"success": True}


def _verify_telegram_hash(data: dict, received_hash: str) -> bool:
    try:
        token = config.TELEGRAM_BOT_TOKEN
        if not token:
            return False
        check_arr = sorted([f"{k}={v}" for k, v in data.items() if k != "hash"])
        check_string = "\n".join(check_arr)
        secret_key = hashlib.sha256(token.encode()).digest()
        computed = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, received_hash)
    except Exception as exc:
        log.error("Telegram hash verification: %s", exc)
        return False


@router.post("/telegram/verify-oauth")
async def verify_telegram_oauth(data: TelegramOAuthData, user=Depends(get_current_user)):
    payload = data.model_dump()
    received_hash = payload.pop("hash", "")
    if not _verify_telegram_hash(payload, received_hash):
        raise HTTPException(status_code=400, detail="Invalid Telegram authentication")

    auth_age = int(time.time()) - int(payload.get("auth_date", 0))
    if auth_age > 600:
        raise HTTPException(status_code=400, detail="Telegram auth expired - please try again")

    user_id = user["id"]
    telegram_user_id = str(payload["id"])
    telegram_username = payload.get("username", "")
    db.update_user(
        user_id,
        {
            "telegram_user_id": telegram_user_id,
            "telegram_username": telegram_username,
            "telegram_linked": True,
            "telegram_link_token": None,
            "telegram_link_expires": None,
        },
    )
    return {
        "success": True,
        "telegram_username": telegram_username,
        "telegram_first_name": payload.get("first_name", ""),
    }


@router.post("/telegram/disconnect")
async def telegram_disconnect(user: dict = Depends(get_current_user)):
    db.update_user(
        user["id"],
        {
            "telegram_user_id": None,
            "telegram_username": None,
            "telegram_linked": False,
            "telegram_link_token": None,
            "telegram_link_expires": None,
        },
    )
    return {"success": True}
