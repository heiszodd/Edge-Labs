from __future__ import annotations

import time
from typing import Any

import httpx

BINANCE_KLINES = "https://api.binance.com/api/v3/klines"

HTF_MAP = {
    "1m": "5m",
    "5m": "1h",
    "15m": "1h",
    "30m": "1h",
    "1h": "4h",
    "4h": "1d",
    "1d": "1w",
}

_CACHE: dict[tuple[str, str, int], tuple[float, list[dict[str, Any]]]] = {}
_TTL_S = 25


def get_htf(timeframe) -> str:
    return HTF_MAP.get(timeframe, "1d")


def _to_rows(raw: list[list[Any]]) -> list[dict[str, Any]]:
    rows = []
    for r in raw:
        rows.append(
            {
                "timestamp": int(r[0]),
                "open": float(r[1]),
                "high": float(r[2]),
                "low": float(r[3]),
                "close": float(r[4]),
                "volume": float(r[5]),
            }
        )
    return rows


async def fetch_candles(pair, timeframe, limit=100) -> list:
    key = (pair, timeframe, int(limit))
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached[0] < _TTL_S:
        return cached[1]
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(BINANCE_KLINES, params={"symbol": pair, "interval": timeframe, "limit": limit})
            r.raise_for_status()
            rows = _to_rows(r.json() or [])
            _CACHE[key] = (now, rows)
            return rows
    except Exception:
        return []


async def fetch_candles_range(pair, timeframe, start_ms, end_ms) -> list:
    out = []
    cursor = int(start_ms)
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            while cursor < int(end_ms):
                r = await c.get(
                    BINANCE_KLINES,
                    params={
                        "symbol": pair,
                        "interval": timeframe,
                        "startTime": cursor,
                        "endTime": end_ms,
                        "limit": 1000,
                    },
                )
                r.raise_for_status()
                batch = _to_rows(r.json() or [])
                if not batch:
                    break
                out.extend(batch)
                cursor = int(batch[-1]["timestamp"]) + 1
                if len(batch) < 1000:
                    break
    except Exception:
        return []
    return out
