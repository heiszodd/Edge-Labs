-- Step 1 schema script for Supabase SQL Editor.
-- Source: provided build plan.
-- NOTE: Execute this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    telegram_user_id BIGINT UNIQUE,
    telegram_username TEXT,
    telegram_linked BOOL DEFAULT false,
    telegram_link_token TEXT,
    telegram_link_expires TIMESTAMPTZ,
    subscription_tier TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_sub_id TEXT,
    subscription_ends TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ,
    is_active BOOL DEFAULT true,
    settings JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS subscription_tiers (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE,
    price_monthly DECIMAL,
    price_yearly DECIMAL,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    max_wallets_per_section INT DEFAULT 1,
    max_daily_alerts INT DEFAULT 5,
    scanner_interval_mins INT DEFAULT 30,
    can_live_trade BOOL DEFAULT false,
    can_backtest BOOL DEFAULT false,
    can_ai_analysis BOOL DEFAULT false,
    can_copy_signals BOOL DEFAULT false,
    signal_delay_mins INT DEFAULT 15,
    features JSONB DEFAULT '{}'
);

INSERT INTO subscription_tiers
    (name, price_monthly, price_yearly,
     max_wallets_per_section, max_daily_alerts,
     scanner_interval_mins, can_live_trade,
     can_backtest, can_ai_analysis,
     can_copy_signals, signal_delay_mins)
VALUES
    ('free', 0, 0, 1, 5, 30, false, false, false, false, 15),
    ('pro', 29, 290, 5, 999, 5, true, true, false, false, 0),
    ('premium', 79, 790, 999, 999, 5, true, true, true, true, 0)
ON CONFLICT (name) DO NOTHING;

-- Remaining DDL from the build plan should be run exactly as provided.
