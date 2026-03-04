from __future__ import annotations

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend import config, db

bearer = HTTPBearer(auto_error=False)


def _resolve_auth_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    cookie_token: str | None,
) -> str:
    if credentials and credentials.credentials:
        return credentials.credentials
    if cookie_token:
        return cookie_token
    # Fallback for non-browser clients that may send a raw cookie header.
    header_cookie = request.headers.get("cookie", "")
    if header_cookie:
        marker = f"{config.AUTH_COOKIE_NAME}="
        for part in header_cookie.split(";"):
            item = part.strip()
            if item.startswith(marker):
                return item[len(marker):]
    return ""


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    cookie_token: str | None = Cookie(default=None, alias=config.AUTH_COOKIE_NAME),
) -> dict:
    token = _resolve_auth_token(request, credentials, cookie_token)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    user = {}
    try:
        user = db._client.auth.get_user(token).user if db._client else {}  # type: ignore[attr-defined]
    except Exception:
        user = {}
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = getattr(user, "id", None) or user.get("id")
    row = db.get_user_by_id(user_id) if user_id else {}
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return row


def require_tier(min_tier: str):
    tier_rank = {"free": 0, "pro": 1, "premium": 2}

    def _checker(user: dict = Depends(get_current_user)):
        user_tier = str(user.get("subscription_tier", "free")).lower()
        if tier_rank.get(user_tier, 0) < tier_rank.get(min_tier, 0):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient subscription tier")
        return user

    return _checker


def require_live_trading():
    return require_tier("pro")


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    role = str(user.get("role", "user")).lower()
    is_admin = bool(user.get("is_admin", False))
    if not (is_admin or role == "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
