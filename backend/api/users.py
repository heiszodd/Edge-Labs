from __future__ import annotations

from fastapi import APIRouter, Depends

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user

router = APIRouter(prefix='/api/users', tags=['users'])


@router.get('/settings')
def get_settings(user: dict = Depends(get_current_user)):
    return ok(db.get_user_settings(user['id']))


@router.put('/settings')
def put_settings(payload: dict, user: dict = Depends(get_current_user)):
    db.update_user_settings(user['id'], payload)
    return ok(db.get_user_settings(user['id']))


@router.get('/subscription')
def subscription(user: dict = Depends(get_current_user)):
    return ok({'tier': user.get('subscription_tier', 'free'), 'status': user.get('subscription_status', 'active')})
