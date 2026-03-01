from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

BINANCE_KLINES = "https://api.binance.com/api/v3/klines"
BYBIT_KLINES = "https://api.bybit.com/v5/market/kline"
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


def _normalize_pair(pair: str) -> str:
    raw = str(pair or "").upper().strip()
    raw = raw.replace("/", "").replace("-", "").replace("_", "").replace(":", "")
    raw = re.sub(r"[^A-Z0-9]", "", raw)
    if raw.endswith("PERP"):
        raw = raw[:-4]
    if raw and not raw.endswith(("USDT", "USDC", "BUSD", "FDUSD")):
        raw = f"{raw}USDT"
    return raw or "BTCUSDT"


def _normalize_timeframe(timeframe: str) -> str:
    valid_tfs = {"1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"}
    value = str(timeframe or "1h").strip()
    return value if value in valid_tfs else "1h"


def _to_bybit_interval(timeframe: str) -> str | None:
    mapping = {
        "1m": "1",
        "3m": "3",
        "5m": "5",
        "15m": "15",
        "30m": "30",
        "1h": "60",
        "2h": "120",
        "4h": "240",
        "6h": "360",
        "12h": "720",
        "1d": "D",
    }
    return mapping.get(timeframe)


async def _fetch_binance(c: httpx.AsyncClient, pair: str, timeframe: str, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    r = await c.get(BINANCE_KLINES, params={"symbol": pair, "interval": timeframe, "limit": limit})
    if r.status_code != 200:
        detail = ""
        try:
            detail = str(r.json())[:500]
        except Exception:
            detail = r.text[:500]
        return [], {"provider": "binance", "status_code": r.status_code, "detail": detail}
    raw = r.json()
    if not raw or not isinstance(raw, list):
        return [], {"provider": "binance", "status_code": 200, "detail": "empty_or_invalid_body"}
    return _to_rows(raw), {"provider": "binance", "status_code": 200, "detail": ""}


async def _fetch_bybit(c: httpx.AsyncClient, pair: str, timeframe: str, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    interval = _to_bybit_interval(timeframe)
    if not interval:
        return [], {"provider": "bybit", "status_code": 400, "detail": "unsupported_timeframe"}
    r = await c.get(BYBIT_KLINES, params={"category": "linear", "symbol": pair, "interval": interval, "limit": limit})
    if r.status_code != 200:
        return [], {"provider": "bybit", "status_code": r.status_code, "detail": r.text[:500]}
    payload = r.json() or {}
    result = payload.get("result", {}) if isinstance(payload, dict) else {}
    rows = (result.get("list") or []) if isinstance(result, dict) else []
    if not rows:
        return [], {"provider": "bybit", "status_code": 200, "detail": "empty_list"}
    parsed = []
    for row in rows:
        # Bybit rows: [startTime, open, high, low, close, volume, turnover]
        try:
            parsed.append(
                {
                    "timestamp": int(float(row[0])),
                    "open": float(row[1]),
                    "high": float(row[2]),
                    "low": float(row[3]),
                    "close": float(row[4]),
                    "volume": float(row[5]),
                }
            )
        except Exception:
            continue
    parsed.sort(key=lambda x: x["timestamp"])
    if not parsed:
        return [], {"provider": "bybit", "status_code": 200, "detail": "parse_failed"}
    return parsed, {"provider": "bybit", "status_code": 200, "detail": ""}


async def fetch_candles(pair, timeframe, limit=100) -> list:
    detail = await fetch_candles_detailed(pair, timeframe, limit)
    return detail.get("candles", [])


async def fetch_candles_detailed(pair, timeframe, limit=100) -> dict[str, Any]:
    pair = _normalize_pair(str(pair or ""))
    timeframe = _normalize_timeframe(str(timeframe or "1h"))
    limit = int(max(1, min(int(limit or 100), 1000)))
    key = _cache_key(pair, timeframe, limit)
    if _is_fresh(key):
        return {
            "candles": _cache[key]["data"],
            "pair": pair,
            "timeframe": timeframe,
            "count": len(_cache[key]["data"]),
            "source": "cache",
            "provider": _cache[key].get("provider", "cache"),
            "error": "",
            "status_code": 200,
        }
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            rows, meta = await _fetch_binance(c, pair, timeframe, limit)
            if rows:
                _cache[key] = {"data": rows, "ts": time.time(), "provider": "binance"}
                return {"candles": rows, "pair": pair, "timeframe": timeframe, "count": len(rows), "source": "live", "provider": "binance", "error": "", "status_code": 200}

            log.warning("OHLCV binance failed pair=%s tf=%s status=%s detail=%s", pair, timeframe, meta.get("status_code"), meta.get("detail"))
            bybit_rows, bybit_meta = await _fetch_bybit(c, pair, timeframe, limit)
            if bybit_rows:
                _cache[key] = {"data": bybit_rows, "ts": time.time(), "provider": "bybit"}
                return {
                    "candles": bybit_rows,
                    "pair": pair,
                    "timeframe": timeframe,
                    "count": len(bybit_rows),
                    "source": "live",
                    "provider": "bybit",
                    "error": "",
                    "status_code": 200,
                }
            log.warning(
                "OHLCV bybit failed pair=%s tf=%s status=%s detail=%s",
                pair,
                timeframe,
                bybit_meta.get("status_code"),
                bybit_meta.get("detail"),
            )
            return {
                "candles": [],
                "pair": pair,
                "timeframe": timeframe,
                "count": 0,
                "source": "none",
                "provider": "binance,bybit",
                "status_code": bybit_meta.get("status_code") or meta.get("status_code") or 500,
                "error": f"no_candles: binance={meta.get('detail') or meta.get('status_code')} bybit={bybit_meta.get('detail') or bybit_meta.get('status_code')}",
            }
    except httpx.TimeoutException:
        log.warning("OHLCV timeout: %s %s", pair, timeframe)
        return {"candles": [], "pair": pair, "timeframe": timeframe, "count": 0, "source": "none", "provider": "binance,bybit", "status_code": 504, "error": "timeout"}
    except Exception:
        log.exception("OHLCV fetch failed for %s %s", pair, timeframe)
        return {"candles": [], "pair": pair, "timeframe": timeframe, "count": 0, "source": "none", "provider": "binance,bybit", "status_code": 500, "error": "exception"}


async def fetch_candles_range(pair, timeframe, start_ms, end_ms) -> list:
    pair = _normalize_pair(pair)
    timeframe = _normalize_timeframe(timeframe)
    out = []
    cursor = int(start_ms)
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            while cursor < int(end_ms):
                r = await c.get(
                    BINANCE_KLINES,
                    params={"symbol": pair, "interval": timeframe, "startTime": cursor, "endTime": end_ms, "limit": 1000},
                )
                if r.status_code != 200:
                    break
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
    if out:
        return out
    # Fallback provider for ranges: Bybit returns latest-first chunks and does not accept a full range the same way.
    try:
        needed = min(1000, max(200, int((int(end_ms) - int(start_ms)) / 60000)))
        detail = await fetch_candles_detailed(pair, timeframe, needed)
        rows = detail.get("candles", [])
        return [x for x in rows if int(start_ms) <= int(x.get("timestamp", 0)) <= int(end_ms)]
    except Exception:
        return []
    return out
