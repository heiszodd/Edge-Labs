from __future__ import annotations

from backend import db


def _get_exchange(user_id: str):
    key = db.get_encrypted_key(user_id, "hl_pk")
    return {"ready": bool(key)}


async def place_market_order(user_id, coin, is_buy, size, slippage=0.05):
    return {"success": bool(_get_exchange(user_id)["ready"]), "type": "market", "coin": coin, "is_buy": is_buy, "size": size, "slippage": slippage}


async def place_limit_order(user_id, coin, is_buy, size, price, reduce_only=False):
    return {"success": bool(_get_exchange(user_id)["ready"]), "type": "limit", "coin": coin, "is_buy": is_buy, "size": size, "price": price, "reduce_only": reduce_only}


async def place_bracket_order(user_id, coin, is_buy, size, entry, stop_loss, take_profit):
    return {"success": bool(_get_exchange(user_id)["ready"]), "type": "bracket", "coin": coin, "is_buy": is_buy, "size": size, "entry": entry, "stop_loss": stop_loss, "take_profit": take_profit}


async def place_stop_order(user_id, coin, is_buy, size, trigger_px):
    return {"success": bool(_get_exchange(user_id)["ready"]), "type": "stop", "coin": coin, "is_buy": is_buy, "size": size, "trigger_px": trigger_px}


async def cancel_order(user_id, coin, order_id):
    return {"success": bool(_get_exchange(user_id)["ready"]), "coin": coin, "order_id": order_id}


async def close_position(user_id, coin, size, is_long, pct=100.0):
    return {"success": bool(_get_exchange(user_id)["ready"]), "coin": coin, "size": size, "is_long": is_long, "pct": pct}


async def set_leverage(user_id, coin, leverage, is_cross=True):
    return {"success": bool(_get_exchange(user_id)["ready"]), "coin": coin, "leverage": leverage, "is_cross": is_cross}
