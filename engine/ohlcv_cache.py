from __future__ import annotations

import logging
import time
from typing import Any

import httpx

BINANCE_KLINES = "https://api.binance.com/api/v3/klines"
log = logging.getLogger(__name__)

HTF_MAP = {
    "1m": "5m",
    "3m": "15m",
    "5m": "15m",
    "15m": "1h",
    "30m": "1h",
    "1h": "4h",
    "2h": "4h",
    "4h": "1d",
    "6h": "1d",
    "12h": "1d",
    "1d": "1w",
}

_cache: dict[str, dict[str, Any]] = {}
_CACHE_TTL = 25


def get_htf(timeframe) -> str:
    return HTF_MAP.get(timeframe, "1d")


def _cache_key(pair: str, timeframe: str, limit: int) -> str:
    return f"{pair}:{timeframe}:{limit}"


def _is_fresh(key: str) -> bool:
    entry = _cache.get(key)
    if not entry:
        return False
    return (time.time() - float(entry["ts"])) < _CACHE_TTL


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
    pair = str(pair or "").upper().replace("/", "").replace("-", "")
    timeframe = str(timeframe or "1h")
    valid_tfs = {"1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"}
    if timeframe not in valid_tfs:
        log.warning("Invalid timeframe %s, defaulting to 1h", timeframe)
        timeframe = "1h"
    limit = int(max(1, min(int(limit or 100), 1000)))

    key = _cache_key(pair, timeframe, limit)
    if _is_fresh(key):
        return _cache[key]["data"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(BINANCE_KLINES, params={"symbol": pair, "interval": timeframe, "limit": limit})
            if r.status_code != 200:
                try:
                    detail = r.json()
                except Exception:
                    detail = r.text[:500]
                log.error("Binance error %s %s: %s", pair, timeframe, detail)
                return []
            raw = r.json()
            if not raw or not isinstance(raw, list):
                return []
            rows = _to_rows(raw)
            _cache[key] = {"data": rows, "ts": time.time()}
            return rows
    except httpx.TimeoutException:
        log.warning("OHLCV timeout: %s %s", pair, timeframe)
        return []
    except Exception:
        log.exception("OHLCV fetch failed for %s %s", pair, timeframe)
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
                        "symbol": str(pair).upper(),
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
        log.exception("OHLCV range fetch failed for %s %s", pair, timeframe)
        return []
    return out
