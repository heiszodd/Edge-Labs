from __future__ import annotations

from fastapi import APIRouter, Depends

from backend import db
from backend.api.common import ok
from backend.dependencies import get_current_user

router = APIRouter(prefix='/api/journal', tags=['journal'])


@router.get('')
def get_journal(user: dict = Depends(get_current_user)):
    return ok(db.get_journal_entries(user['id']))


@router.post('')
def create_journal(payload: dict, user: dict = Depends(get_current_user)):
    entry_id = db.save_journal_entry(user['id'], payload)
    return ok({'id': entry_id})


@router.put('/{entry_id}')
def update_journal(entry_id: int, payload: dict, user: dict = Depends(get_current_user)):
    db.update_journal_entry(entry_id, user['id'], payload)
    return ok({'id': entry_id})


@router.delete('/{entry_id}')
def delete_journal(entry_id: int, user: dict = Depends(get_current_user)):
    db.delete_journal_entry(entry_id, user['id'])
    return ok({'id': entry_id})
