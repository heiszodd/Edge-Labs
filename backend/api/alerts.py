from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user

router = APIRouter(prefix='/api/alerts', tags=['alerts'])


class AlertBody(BaseModel):
    symbol: str
    condition: str
    target_price: float


@router.get('')
def get_alerts(user: dict = Depends(get_current_user)):
    return ok(db.get_price_alerts(user['id']))


@router.post('')
def create_alert(body: AlertBody, user: dict = Depends(get_current_user)):
    db.save_price_alert(user['id'], body.model_dump())
    return ok(body.model_dump())


@router.delete('/{alert_id}')
def delete_alert(alert_id: int, user: dict = Depends(get_current_user)):
    db._delete('price_alerts', id=alert_id, user_id=user['id'])
    return ok({'id': alert_id})


@router.put('/settings')
def settings(payload: dict, user: dict = Depends(get_current_user)):
    db._upsert('alert_settings', {'user_id': user['id'], **payload}, on_conflict='user_id')
    return ok(payload)
