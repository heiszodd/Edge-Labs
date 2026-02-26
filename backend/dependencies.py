from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend import db

bearer = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = credentials.credentials
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
