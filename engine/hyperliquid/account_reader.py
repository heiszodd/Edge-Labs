from __future__ import annotations

import httpx

_BASE = "https://api.hyperliquid.xyz/info"


async def fetch_account_summary(address) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(_BASE, json={"type": "clearinghouseState", "user": address})
            r.raise_for_status()
            data = r.json() or {}
            margin = data.get("marginSummary", {})
            return {
                "account_value": float(margin.get("accountValue", 0) or 0),
                "available": float(margin.get("availableMargin", 0) or 0),
                "total_upnl": float(data.get("crossMaintenanceMarginUsed", 0) or 0),
                "margin_used": float(margin.get("totalMarginUsed", 0) or 0),
            }
    except Exception:
        return {"account_value": 0.0, "available": 0.0, "total_upnl": 0.0, "margin_used": 0.0}


async def fetch_positions_with_prices(address) -> list:
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(_BASE, json={"type": "clearinghouseState", "user": address})
            r.raise_for_status()
            data = r.json() or {}
            out = []
            for p in data.get("assetPositions", []):
                pos = p.get("position", {})
                size = float(pos.get("szi", 0) or 0)
                entry = float(pos.get("entryPx", 0) or 0)
                mark = float(pos.get("markPx", entry) or entry)
                pnl = (mark - entry) * size
                out.append({"coin": pos.get("coin"), "side": "long" if size >= 0 else "short", "size": abs(size), "entry_price": entry, "mark_price": mark, "live_upnl": pnl, "live_upnl_pct": 0.0 if entry == 0 else pnl / abs(entry * size), "leverage": float(pos.get("leverage", {}).get("value", 0) or 0), "liquidation_price": float(pos.get("liquidationPx", 0) or 0)})
            return out
    except Exception:
        return []


async def fetch_open_orders_parsed(address) -> list:
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(_BASE, json={"type": "openOrders", "user": address})
            r.raise_for_status()
            return r.json() or []
    except Exception:
        return []


async def fetch_trade_history(address, limit=20) -> list:
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(_BASE, json={"type": "userFills", "user": address})
            r.raise_for_status()
            return (r.json() or [])[: int(limit)]
    except Exception:
        return []


async def fetch_funding_summary(address) -> dict:
    try:
        fills = await fetch_trade_history(address, limit=100)
        funding = sum(float(f.get("fee", 0) or 0) for f in fills)
        return {"funding_paid": funding, "count": len(fills)}
    except Exception:
        return {"funding_paid": 0.0, "count": 0}
