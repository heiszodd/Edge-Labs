# Deployment Notes

## Environment Variables

- `VITE_TELEGRAM_BOT_USERNAME` is optional on frontend.
- If `VITE_TELEGRAM_BOT_USERNAME` is missing, the UI now shows a neutral unavailable state and disables Telegram auth actions.

## Wallet Verification Flow

- Wallet linking now supports challenge + signature verification.
- Supported chains:
  - `hl` (EVM signature)
  - `poly` (EVM signature)
  - `sol` (Solana `signMessage` signature)
- Manual address linking still exists as a non-blocking fallback and is marked unverified.
- No private key input is required by UI.

## Backend Dependency Updates

Added runtime dependencies for wallet signature verification:

- `eth-account==0.13.5`
- `PyNaCl==1.5.0`

Install/update dependencies before deploying backend.

## Database Changes

No schema migration required for this update.

- Wallet challenges and verification metadata are stored in `encrypted_keys` with:
  - `${chain}_wallet_challenge`
  - `${chain}_wallet_meta`

## Functional Changes

- Predictions:
  - Live trades are persisted.
  - Demo trades are inserted with valid `demo_trades` columns.
  - Open trades now include computed `entry_price`, `current_mark`, `unrealized_pnl`, `pnl_pct`, `timestamp`.
- Backtesting:
  - Results now expose `total_trades`, `wins`, `losses`, and `pnl_summary`.
  - Trade field aliases are normalized for frontend (`pnl_percent`, `reason`).
- Degen:
  - Scanner no longer uses placeholder token universe.
  - Candidate tokens are sourced from DexScreener token profiles + user watchlist.
  - Degen model builder UI is now available and scanner behavior reflects active models.
- Perps:
  - Overview now includes a TradingView widget tied to selected pair.
  - Pair selection is stabilized and persisted per user browser session.
