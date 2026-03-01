from __future__ import annotations

import httpx
from typing import Any

from backend import db
from backend.config import BACKEND_URL, SERVICE_SECRET


async def cmd_start(update: Any, context: Any):
    tg_id = getattr(update.effective_user, 'id', None)
    user = db.get_user_by_telegram_id(tg_id) if tg_id else {}
    if not user:
        await update.message.reply_text('Welcome! Use /link CODE from the web dashboard to connect your account.')
        return
    await update.message.reply_text(f"Linked ✅\nTier: {user.get('subscription_tier', 'free')}")


async def cmd_link(update: Any, context: Any):
    if not context.args:
        await update.message.reply_text('Usage: /link YOUR_CODE')
        return
    token = context.args[0].strip()
    tg_id = update.effective_user.id
    tg_name = update.effective_user.username

    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.post(
            f'{BACKEND_URL}/api/auth/telegram-verify',
            json={'token': token, 'telegram_user_id': tg_id, 'telegram_username': tg_name},
            headers={'X-Service-Key': SERVICE_SECRET},
        )
    if r.status_code == 200:
        await update.message.reply_text("✅ Telegram linked! You'll now receive alerts here.")
    else:
        await update.message.reply_text('❌ Invalid or expired code.')


async def cmd_status(update: Any, context: Any):
    return await cmd_start(update, context)


async def cmd_halt(update: Any, context: Any):
    user = db.get_user_by_telegram_id(update.effective_user.id)
    if user:
        db.set_halt(user['id'], True)
    await update.message.reply_text('Trading halted.')


async def cmd_resume(update: Any, context: Any):
    user = db.get_user_by_telegram_id(update.effective_user.id)
    if user:
        db.set_halt(user['id'], False)
    await update.message.reply_text('Trading resumed.')


async def cmd_help(update: Any, context: Any):
    await update.message.reply_text('/start /link /status /halt /resume')
