from __future__ import annotations


async def place_poly_market_order(user_id, token_id, side, size_usd, price) -> dict:
    try:
        return {"success": True, "user_id": user_id, "token_id": token_id, "side": side, "size_usd": size_usd, "price": price}
    except Exception as e:
        return {"success": False, "error": str(e)}
