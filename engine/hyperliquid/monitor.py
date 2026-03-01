from __future__ import annotations

from backend import db
from backend.bot.alert_sender import send_alert
from engine.hyperliquid.account_reader import fetch_positions_with_prices, fetch_trade_history


async def run_hl_monitor_for_user(user_id, context) -> None:
    if not db.get_hl_address(user_id):
        return
    positions, _ = await fetch_positions_with_prices(user_id)
    fills = await fetch_trade_history(user_id, limit=50)
    existing = {str(x.get("hash") or x.get("tid")) for x in db.get_hl_trade_history(user_id, limit=200)}
    for fill in fills:
        key = str(fill.get("hash") or fill.get("tid"))
        if key in existing:
            continue
        db.save_hl_trade(user_id, fill)
        await send_alert(user_id, f"New HL fill: {fill}")
    db.upsert_hl_positions(user_id, positions)
