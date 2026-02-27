from __future__ import annotations

from backend.services.external_api import ApiFailure, request_json

_BASE = "https://api.hyperliquid.xyz/info"


def _to_num(value, default=0.0) -> float:
    try:
        return float(value or 0)
    except Exception:
        return float(default)


async def _state(address: str) -> tuple[dict, ApiFailure | None]:
    if not isinstance(address, str) or not address.strip():
        return {}, ApiFailure(reason="invalid_address", detail="Wallet address is missing")
    cleaned = address.strip()
    if not cleaned.startswith("0x") or len(cleaned) != 42:
        return {}, ApiFailure(reason="invalid_address", detail="Hyperliquid wallet address must be 0x-prefixed 42 chars")
    data, failure = await request_json("POST", _BASE, json={"type": "clearinghouseState", "user": address})
    return (data or {}), failure


async def fetch_api_health() -> dict:
    _, failure = await request_json("POST", _BASE, json={"type": "meta"}, timeout=6.0)
    if failure:
        return {"status": "disconnected", "latency_ms": None, "reason": failure.reason}
    return {"status": "connected", "latency_ms": None, "reason": ""}


async def fetch_account_summary(address) -> tuple[dict, ApiFailure | None]:
    data, failure = await _state(address)
    margin = data.get("marginSummary", {})
    return {
        "account_value": _to_num(margin.get("accountValue")),
        "available": _to_num(margin.get("availableMargin")),
        "total_upnl": _to_num(data.get("crossMaintenanceMarginUsed")),
        "margin_used": _to_num(margin.get("totalMarginUsed")),
    }, failure


async def fetch_positions_with_prices(address) -> tuple[list, ApiFailure | None]:
    data, failure = await _state(address)
    out = []
    for p in data.get("assetPositions", []):
        pos = p.get("position", {})
        size = _to_num(pos.get("szi"))
        entry = _to_num(pos.get("entryPx"))
        mark = _to_num(pos.get("markPx"), default=entry)
        pnl = (mark - entry) * size
        out.append(
            {
                "coin": pos.get("coin"),
                "side": "long" if size >= 0 else "short",
                "size": abs(size),
                "entry_price": entry,
                "mark_price": mark,
                "live_upnl": pnl,
                "live_upnl_pct": 0.0 if entry == 0 else pnl / max(abs(entry * size), 1e-9),
                "leverage": _to_num((pos.get("leverage") or {}).get("value")),
                "liquidation_price": _to_num(pos.get("liquidationPx")),
            }
        )
    return out, failure


async def fetch_open_orders_parsed(address) -> tuple[list, ApiFailure | None]:
    data, failure = await request_json("POST", _BASE, json={"type": "openOrders", "user": address})
    return (data or []), failure


async def fetch_trade_history(address, limit=20) -> tuple[list, ApiFailure | None]:
    data, failure = await request_json("POST", _BASE, json={"type": "userFills", "user": address})
    return (data or [])[: int(limit)], failure


async def fetch_funding_summary(address) -> dict:
    try:
        fills, _ = await fetch_trade_history(address, limit=100)
        funding = sum(float(f.get("fee", 0) or 0) for f in fills)
        return {"funding_paid": funding, "count": len(fills)}
    except Exception:
        return {"funding_paid": 0.0, "count": 0}
