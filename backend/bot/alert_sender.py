from __future__ import annotations

import logging
from typing import Any

from backend import db

logger = logging.getLogger(__name__)


class _NoopBot:
    async def send_message(self, **kwargs: Any) -> None:
        return None


bot: Any = _NoopBot()


async def send_alert(user_id: str, text: str, keyboard=None) -> bool:
    """
    Send Telegram alert to user if linked.
    Returns True if sent, False if not linked
    or failed.
    """
    user = db.get_user_by_id(user_id)
    if not user or not user.get("telegram_linked"):
        return False
    tg_id = user.get("telegram_user_id")
    if not tg_id:
        return False
    try:
        await bot.send_message(
            chat_id=tg_id,
            text=text,
            parse_mode="Markdown",
            reply_markup=keyboard,
        )
        return True
    except Exception as e:
        logger.warning("Alert send failed user=%s: %s", user_id, e)
        return False


async def send_signal_alert(user_id: str, signal: dict[str, Any]) -> bool:
    try:
        pair = signal.get("pair", "PAIR")
        direction = str(signal.get("direction", "neutral")).upper()
        grade = signal.get("quality_grade", signal.get("grade", "F"))
        score = signal.get("quality_score", 0)
        text = f"*Signal*: {pair} {direction}\nGrade: {grade}\nScore: {score}"
        return await send_alert(user_id, text)
    except Exception:
        return False
