from __future__ import annotations

import httpx
from typing import Any

from backend.config import BACKEND_URL, SERVICE_SECRET


async def cmd_link(update: Any, context: Any):
    if not context.args:
        await update.message.reply_text(
            "Usage: /link YOUR_CODE\n\n"
            "Get your code at:\n"
            "dashboard.yourdomain.com"
            " → Settings → Telegram"
        )
        return
    token = context.args[0].strip()
    tg_id = update.effective_user.id
    tg_name = update.effective_user.username

    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.post(
            f"{BACKEND_URL}/api/auth/telegram-verify",
            json={
                "token": token,
                "telegram_user_id": tg_id,
                "telegram_username": tg_name,
            },
            headers={"X-Service-Key": SERVICE_SECRET},
        )
    if r.status_code == 200:
        await update.message.reply_text(
            "✅ Telegram linked!\n\n"
            "You'll now receive alerts here."
        )
    else:
        await update.message.reply_text(
            "❌ Invalid or expired code.\n"
            "Generate a new one on the dashboard."
        )
