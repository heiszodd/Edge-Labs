from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.api.common import ok
from backend.dependencies import get_current_user

router = APIRouter(prefix='/api/payments', tags=['payments'])


class CheckoutBody(BaseModel):
    tier: str
    interval: str


@router.post('/create-checkout')
def create_checkout(body: CheckoutBody, user: dict = Depends(get_current_user)):
    return ok({'checkout_url': f'https://checkout.example/{body.tier}/{body.interval}?u={user["id"]}'})


@router.post('/webhook')
def webhook(payload: dict):
    return ok({'received': True, 'event': payload.get('type')})


@router.post('/cancel')
def cancel(user: dict = Depends(get_current_user)):
    return ok({'portal_url': f'https://billing.example/portal?u={user["id"]}'})


@router.get('/status')
def status(user: dict = Depends(get_current_user)):
    return ok({'tier': user.get('subscription_tier', 'free'), 'status': user.get('subscription_status', 'active')})
