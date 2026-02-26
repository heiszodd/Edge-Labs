from __future__ import annotations

import httpx

from backend import db


async def run_market_scanner() -> list:
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get("https://gamma-api.polymarket.com/markets")
            r.raise_for_status()
            markets = r.json() or []
    except Exception:
        markets = []
    scored = [{"market": m, "score": _score_market(m)} for m in markets]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def _score_market(m) -> float:
    vol = min(30.0, float(m.get("volume", 0) or 0) / 10000)
    liq = min(20.0, float(m.get("liquidity", 0) or 0) / 10000)
    price = float(m.get("lastTradePrice", 0.5) or 0.5)
    near_50 = max(0.0, 30.0 - abs(price - 0.5) * 60)
    dtr = float(m.get("daysToResolve", 30) or 30)
    days = max(0.0, 20.0 - abs(dtr - 14))
    return max(0.0, min(100.0, vol + liq + near_50 + days))


async def run_scanner_for_user(user_id) -> None:
    markets = await run_market_scanner()
    models = [m for m in db.get_user_models(user_id, active_only=True) if m.get("section") == "predictions"]
    for model in models:
        min_score = float(model.get("min_score", 70))
        for entry in markets[:100]:
            if entry["score"] >= min_score:
                db.save_pending_signal({"user_id": user_id, "section": "predictions", "status": "pending", "meta": entry})
