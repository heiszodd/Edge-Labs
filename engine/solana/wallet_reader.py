from __future__ import annotations

import logging

import httpx

from backend.config import HELIUS_RPC_URL

log = logging.getLogger(__name__)

JUPITER_PRICE = "https://price.jup.ag/v4/price"
SOL_MINT = "So11111111111111111111111111111111111111112"


async def get_token_price_usd(mint: str) -> float:
    """Returns 0.0 on any error. Never raises."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(JUPITER_PRICE, params={"ids": mint})
            response.raise_for_status()
            data = response.json()
            price = ((data.get("data", {}) or {}).get(mint, {}) or {}).get("price", 0)
            return float(price or 0)
    except Exception as exc:
        log.error("get_token_price %s: %s", mint, exc)
        return 0.0


async def get_sol_price_usd() -> float:
    return await get_token_price_usd(SOL_MINT)


async def get_wallet_sol_balance(wallet_address: str) -> float:
    if not HELIUS_RPC_URL:
        return 0.0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                HELIUS_RPC_URL,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getBalance",
                    "params": [wallet_address],
                },
            )
            response.raise_for_status()
            lamports = (response.json().get("result", {}) or {}).get("value", 0)
            return float(lamports or 0) / 1e9
    except Exception as exc:
        log.error("get_sol_balance %s: %s", wallet_address, exc)
        return 0.0


async def get_wallet_summary(address) -> dict:
    sol_balance = await get_wallet_sol_balance(address)
    return {"sol_balance": sol_balance, "usdc_balance": 0.0, "token_count": 0, "tokens": []}
