from __future__ import annotations

import httpx

from backend.config import HELIUS_RPC_URL


async def get_wallet_summary(address) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(HELIUS_RPC_URL, json={"jsonrpc": "2.0", "id": 1, "method": "getBalance", "params": [address]})
            r.raise_for_status()
            lamports = (r.json() or {}).get("result", {}).get("value", 0)
            return {"sol_balance": lamports / 1_000_000_000, "usdc_balance": 0.0, "token_count": 0}
    except Exception:
        return {"sol_balance": 0.0, "usdc_balance": 0.0, "token_count": 0}


async def get_token_price_usd(mint) -> float:
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(f"https://price.jup.ag/v4/price?ids={mint}")
            r.raise_for_status()
            data = (r.json() or {}).get("data", {}).get(mint, {})
            return float(data.get("price", 0) or 0)
    except Exception:
        return 0.0
