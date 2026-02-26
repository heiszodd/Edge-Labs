from __future__ import annotations

import time
import uuid
from typing import Callable

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

_TTL_SECONDS = 60
_pending: dict[str, dict] = {}


def create_confirmation(user_id, plan, callback: Callable[[], dict]) -> str:
    cid = str(uuid.uuid4())
    _pending[cid] = {
        "user_id": str(user_id),
        "plan": plan,
        "callback": callback,
        "expires_at": time.time() + _TTL_SECONDS,
    }
    return cid


def execute_confirmation(cid) -> dict:
    record = _pending.get(cid)
    if not record:
        return {"ok": False, "error": "Confirmation not found"}
    if time.time() > record["expires_at"]:
        _pending.pop(cid, None)
        return {"ok": False, "error": "Confirmation expired"}
    callback = record["callback"]
    _pending.pop(cid, None)
    return callback()


def cancel_confirmation(cid):
    _pending.pop(cid, None)


def build_confirmation_keyboard(cid, section) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[
            InlineKeyboardButton("✅ Confirm", callback_data=f"confirm:{section}:{cid}"),
            InlineKeyboardButton("❌ Cancel", callback_data=f"cancel:{section}:{cid}"),
        ]]
    )
