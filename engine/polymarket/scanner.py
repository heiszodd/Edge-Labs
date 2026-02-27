from __future__ import annotations

from backend import db
from backend.services.external_api import request_json


async def run_market_scanner(limit: int = 100, offset: int = 0, category: str | None = None) -> list:
    params = {"limit": int(limit), "offset": int(offset)}
    if category and category.lower() != "all":
        params["category"] = category
    data, _ = await request_json("GET", "https://gamma-api.polymarket.com/markets", params=params, timeout=12.0)
    markets = data or []
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
    markets = await run_market_scanner(limit=200, offset=0)
    models = db.get_prediction_models(user_id, active_only=True)
    for model in models:
        min_score = float(model.get("min_score", 70))
        for entry in markets[:100]:
            if entry["score"] >= min_score:
                db.save_pending_signal({"user_id": user_id, "section": "predictions", "status": "pending", "meta": entry})
