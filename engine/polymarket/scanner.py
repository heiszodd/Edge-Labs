from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx

log = logging.getLogger(__name__)

GAMMA_API = "https://gamma-api.polymarket.com"

CRYPTO_KEYWORDS = [
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "solana",
    "sol",
    "crypto",
    "bnb",
    "xrp",
    "price",
    "above",
    "below",
    "reach",
    "hit",
    "exceed",
    "$",
    "usd",
    "usdt",
    "coinbase",
    "binance",
    "doge",
    "avax",
    "sui",
]


def _grade(score: float) -> str:
    if score >= 80:
        return "S"
    if score >= 70:
        return "A"
    if score >= 60:
        return "B"
    if score >= 50:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def _score_market(volume: float, days_left: int | None, yes_price: float, liquidity: float) -> float:
    score = 0.0

    if volume >= 500_000:
        score += 35
    elif volume >= 100_000:
        score += 28
    elif volume >= 50_000:
        score += 22
    elif volume >= 10_000:
        score += 15
    else:
        score += 8

    if days_left is not None:
        if days_left <= 1:
            score += 35
        elif days_left <= 3:
            score += 28
        elif days_left <= 7:
            score += 20
        elif days_left <= 14:
            score += 10

    distance_from_50 = abs(yes_price - 0.5)
    score += max(0, 20 - distance_from_50 * 40)

    if liquidity >= 100_000:
        score += 10
    elif liquidity >= 10_000:
        score += 7
    elif liquidity >= 1_000:
        score += 4

    return score


def _parse_prices(raw_prices) -> tuple[float, float]:
    yes_price, no_price = 0.5, 0.5
    try:
        values = raw_prices
        if isinstance(values, str):
            values = json.loads(values)
        if isinstance(values, list) and values:
            yes_price = float(values[0] or 0.5)
            no_price = float(values[1] or (1 - yes_price)) if len(values) > 1 else (1 - yes_price)
    except Exception:
        pass
    return yes_price, no_price


async def fetch_polymarket_crypto_markets(limit: int = 10) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{GAMMA_API}/markets",
                params={
                    "active": "true",
                    "closed": "false",
                    "limit": 200,
                    "order": "volume24hr",
                    "ascending": "false",
                },
            )
            response.raise_for_status()
            all_markets = response.json() or []

        now = datetime.now(timezone.utc)
        results = []
        for market in all_markets:
            question = str(market.get("question") or "").lower()
            if not any(keyword in question for keyword in CRYPTO_KEYWORDS):
                continue

            volume = float(market.get("volume", 0) or 0)
            if volume < 5000:
                continue

            days_left = None
            end_date = market.get("endDate") or market.get("end_date_iso")
            if end_date:
                try:
                    end_dt = datetime.fromisoformat(str(end_date).replace("Z", "+00:00"))
                    days_left = (end_dt - now).days
                    if days_left > 14:
                        continue
                except Exception:
                    pass

            yes_price, no_price = _parse_prices(market.get("outcomePrices", []))
            liquidity = float(market.get("liquidity", 0) or 0)

            nearly_resolved = (days_left is not None and days_left <= 7) or max(yes_price, no_price) >= 0.6
            if not nearly_resolved:
                continue

            score = _score_market(
                volume=volume,
                days_left=days_left,
                yes_price=yes_price,
                liquidity=liquidity,
            )

            results.append(
                {
                    "id": market.get("id") or market.get("condition_id", ""),
                    "question": market.get("question", ""),
                    "yes_price": round(yes_price, 4),
                    "no_price": round(no_price, 4),
                    "yes_pct": round(yes_price * 100, 1),
                    "no_pct": round(no_price * 100, 1),
                    "volume_usd": round(volume, 0),
                    "liquidity": round(liquidity, 0),
                    "days_left": days_left,
                    "end_date": end_date,
                    "score": round(score, 1),
                    "grade": _grade(score),
                    "image": market.get("image", ""),
                    "category": "crypto",
                    "market_url": f"https://polymarket.com/event/{market.get('slug', '')}",
                }
            )

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    except httpx.TimeoutException:
        log.warning("Polymarket scanner timeout")
        return []
    except Exception as exc:
        log.error("polymarket scanner: %s", exc)
        return []


async def run_scanner_for_user(user_id: str, limit: int = 10) -> list[dict]:
    # Backward-compatible entry point used by backend.jobs.prediction_scanner_job.
    return await fetch_polymarket_crypto_markets(limit=limit)
