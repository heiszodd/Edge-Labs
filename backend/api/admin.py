from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import db
from backend.dependencies import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

ALLOWED_TIERS = {"free", "pro", "premium"}
ALLOWED_ROLES = {"user", "admin"}
ALLOWED_STATUSES = {"active", "past_due", "canceled", "trialing"}


class TierBody(BaseModel):
    price_monthly: float = 0
    price_yearly: float = 0
    stripe_price_id_monthly: str | None = None
    stripe_price_id_yearly: str | None = None
    max_wallets_per_section: int = 1
    max_daily_alerts: int = 5
    scanner_interval_mins: int = 30
    can_live_trade: bool = False
    can_backtest: bool = False
    can_ai_analysis: bool = False
    can_copy_signals: bool = False
    signal_delay_mins: int = 15
    features: dict = {}


class UserRoleBody(BaseModel):
    role: str


class UserTierBody(BaseModel):
    tier: str
    status: str = "active"


@router.get("/tiers")
def get_tiers(_: dict = Depends(require_admin)):
    return {"ok": True, "data": db.get_subscription_tiers()}


@router.put("/tiers/{name}")
def put_tier(name: str, body: TierBody, _: dict = Depends(require_admin)):
    tier_name = name.strip().lower()
    if tier_name not in ALLOWED_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier '{tier_name}'")
    payload = {"name": tier_name, **body.model_dump()}
    db.upsert_subscription_tier(payload)
    return {"ok": True, "data": payload}


@router.delete("/tiers/{name}")
def delete_tier(name: str, _: dict = Depends(require_admin)):
    tier_name = name.strip().lower()
    if tier_name == "free":
        raise HTTPException(status_code=400, detail="Cannot delete free tier")
    db.delete_subscription_tier(tier_name)
    return {"ok": True}


@router.get("/users")
def get_users(limit: int = 200, _: dict = Depends(require_admin)):
    return {"ok": True, "data": db.get_users(limit=max(1, min(limit, 1000)))}


@router.put("/users/{user_id}/role")
def put_user_role(user_id: str, body: UserRoleBody, _: dict = Depends(require_admin)):
    role = body.role.strip().lower()
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{role}'")
    db.set_user_role(user_id, role=role, is_admin=(role == "admin"))
    return {"ok": True}


@router.put("/users/{user_id}/subscription")
def put_user_subscription(user_id: str, body: UserTierBody, _: dict = Depends(require_admin)):
    tier = body.tier.strip().lower()
    status = body.status.strip().lower()
    if tier not in ALLOWED_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier '{tier}'")
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status '{status}'")
    db.set_user_subscription(user_id, tier=tier, status=status)
    return {"ok": True}
