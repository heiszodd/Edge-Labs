-- STEP 1 - DATABASE SCHEMA
-- Run this file first in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- USERS & AUTH

CREATE TABLE IF NOT EXISTS users (
    id                    UUID PRIMARY KEY
                          DEFAULT gen_random_uuid(),
    email                 TEXT UNIQUE NOT NULL,
    username              TEXT UNIQUE NOT NULL,
    telegram_user_id      BIGINT UNIQUE,
    telegram_username     TEXT,
    telegram_linked       BOOL DEFAULT false,
    telegram_link_token   TEXT,
    telegram_link_expires TIMESTAMPTZ,
    subscription_tier     TEXT DEFAULT 'free',
    subscription_status   TEXT DEFAULT 'active',
    stripe_customer_id    TEXT,
    stripe_sub_id         TEXT,
    subscription_ends     TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    last_seen             TIMESTAMPTZ,
    is_active             BOOL DEFAULT true,
    settings              JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS subscription_tiers (
    id                      SERIAL PRIMARY KEY,
    name                    TEXT UNIQUE,
    price_monthly           DECIMAL,
    price_yearly            DECIMAL,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly  TEXT,
    max_wallets_per_section INT DEFAULT 1,
    max_daily_alerts        INT DEFAULT 5,
    scanner_interval_mins   INT DEFAULT 30,
    can_live_trade          BOOL DEFAULT false,
    can_backtest            BOOL DEFAULT false,
    can_ai_analysis         BOOL DEFAULT false,
    can_copy_signals        BOOL DEFAULT false,
    signal_delay_mins       INT DEFAULT 15,
    features                JSONB DEFAULT '{}'
);

INSERT INTO subscription_tiers
    (name, price_monthly, price_yearly,
     max_wallets_per_section, max_daily_alerts,
     scanner_interval_mins, can_live_trade,
     can_backtest, can_ai_analysis,
     can_copy_signals, signal_delay_mins)
VALUES
    ('free',    0,    0,    1,  5,   30, false,
     false, false, false, 15),
    ('pro',     29,   290,  5,  999, 5,  true,
     true,  false, false, 0),
    ('premium', 79,   790,  999,999, 5,  true,
     true,  true,  true,  0)
ON CONFLICT (name) DO NOTHING;

-- SECURITY

CREATE TABLE IF NOT EXISTS encrypted_keys (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID REFERENCES users(id)
               ON DELETE CASCADE,
    key_name   TEXT NOT NULL,
    encrypted  TEXT NOT NULL,
    label      TEXT DEFAULT '',
    stored_at  TIMESTAMPTZ DEFAULT NOW(),
    last_used  TIMESTAMPTZ,
    UNIQUE(user_id, key_name)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID REFERENCES users(id),
    timestamp  TIMESTAMPTZ DEFAULT NOW(),
    action     TEXT,
    details    JSONB DEFAULT '{}',
    success    BOOL DEFAULT true,
    error      TEXT,
    ip_address TEXT
);

CREATE TABLE IF NOT EXISTS emergency_stop (
    id      SERIAL PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES users(id),
    halted  BOOL DEFAULT false,
    reason  TEXT DEFAULT '',
    set_at  TIMESTAMPTZ DEFAULT NOW()
);

-- USER CONFIG

CREATE TABLE IF NOT EXISTS user_settings (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 UUID UNIQUE
                            REFERENCES users(id),
    buy_preset_1            DECIMAL DEFAULT 25,
    buy_preset_2            DECIMAL DEFAULT 50,
    buy_preset_3            DECIMAL DEFAULT 100,
    buy_preset_4            DECIMAL DEFAULT 250,
    instant_buy_threshold   DECIMAL DEFAULT 50,
    instant_buy_enabled     BOOL DEFAULT true,
    mev_protection          BOOL DEFAULT true,
    simple_mode             BOOL DEFAULT false,
    alert_telegram          BOOL DEFAULT true,
    alert_email             BOOL DEFAULT false,
    alert_web_push          BOOL DEFAULT false,
    live_sl_pct             DECIMAL DEFAULT 20,
    live_sl_enabled         BOOL DEFAULT true,
    live_tp1_pct            DECIMAL DEFAULT 50,
    live_tp1_sell_pct       DECIMAL DEFAULT 25,
    live_tp2_pct            DECIMAL DEFAULT 100,
    live_tp2_sell_pct       DECIMAL DEFAULT 25,
    live_tp3_pct            DECIMAL DEFAULT 200,
    live_tp3_sell_pct       DECIMAL DEFAULT 50,
    live_trail_pct          DECIMAL DEFAULT 30,
    live_trail_auto         BOOL DEFAULT false,
    demo_sl_pct             DECIMAL DEFAULT 20,
    demo_sl_enabled         BOOL DEFAULT true,
    demo_tp1_pct            DECIMAL DEFAULT 50,
    demo_tp1_sell_pct       DECIMAL DEFAULT 25,
    demo_tp2_pct            DECIMAL DEFAULT 100,
    demo_tp2_sell_pct       DECIMAL DEFAULT 25,
    demo_tp3_pct            DECIMAL DEFAULT 200,
    demo_tp3_sell_pct       DECIMAL DEFAULT 50,
    demo_trail_pct          DECIMAL DEFAULT 30,
    demo_trail_auto         BOOL DEFAULT false,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_settings (
    id               BIGSERIAL PRIMARY KEY,
    user_id          UUID REFERENCES users(id),
    section          TEXT,
    max_risk_pct     DECIMAL DEFAULT 1.0,
    daily_loss_limit DECIMAL DEFAULT 200,
    max_positions    INT DEFAULT 5,
    max_leverage     DECIMAL DEFAULT 10,
    max_daily_trades INT DEFAULT 10,
    UNIQUE(user_id, section)
);

-- SIGNALS

CREATE TABLE IF NOT EXISTS pending_signals (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    section         TEXT DEFAULT 'perps',
    pair            TEXT,
    direction       TEXT,
    phase           INT DEFAULT 1,
    timeframe       TEXT,
    quality_grade   TEXT,
    quality_score   DECIMAL DEFAULT 0,
    signal_data     JSONB DEFAULT '{}',
    hl_plan         JSONB DEFAULT '{}',
    status          TEXT DEFAULT 'pending',
    source_model_id BIGINT,
    tier_required   TEXT DEFAULT 'free',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    dismissed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS
    idx_pending_signals_user_status
    ON pending_signals(user_id, status);

-- PERPS

CREATE TABLE IF NOT EXISTS models (
    id                BIGSERIAL PRIMARY KEY,
    user_id           UUID REFERENCES users(id),
    name              TEXT NOT NULL,
    pair              TEXT DEFAULT 'BTCUSDT',
    timeframe         TEXT DEFAULT '1h',
    active            BOOL DEFAULT false,
    description       TEXT DEFAULT '',
    model_meta        JSONB DEFAULT '{}',
    phase1_rules      JSONB DEFAULT '[]',
    phase2_rules      JSONB DEFAULT '[]',
    phase3_rules      JSONB DEFAULT '[]',
    phase4_rules      JSONB DEFAULT '[]',
    min_quality_score DECIMAL DEFAULT 60,
    grade             TEXT,
    signals_today     INT DEFAULT 0,
    total_signals     INT DEFAULT 0,
    pass_rate         DECIMAL DEFAULT 0,
    last_signal_at    TIMESTAMPTZ,
    is_preset         BOOL DEFAULT false,
    is_public         BOOL DEFAULT false,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hl_positions (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 UUID REFERENCES users(id),
    coin                    TEXT,
    side                    TEXT,
    size                    DECIMAL,
    entry_price             DECIMAL,
    mark_price              DECIMAL DEFAULT 0,
    live_upnl               DECIMAL DEFAULT 0,
    live_upnl_pct           DECIMAL DEFAULT 0,
    leverage                DECIMAL DEFAULT 1,
    liquidation_price       DECIMAL DEFAULT 0,
    trailing_stop_pct       DECIMAL,
    trailing_stop_order_id  TEXT,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hl_orders (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID REFERENCES users(id),
    coin       TEXT,
    side       TEXT,
    order_type TEXT DEFAULT 'Limit',
    price      DECIMAL DEFAULT 0,
    size       DECIMAL DEFAULT 0,
    size_usd   DECIMAL DEFAULT 0,
    order_id   TEXT,
    status     TEXT DEFAULT 'open',
    leverage   DECIMAL DEFAULT 1,
    stop_loss  DECIMAL DEFAULT 0,
    tp1        DECIMAL DEFAULT 0,
    fill_price DECIMAL DEFAULT 0,
    fill_time  TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, order_id)
);

CREATE TABLE IF NOT EXISTS hl_trade_history (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    coin        TEXT,
    side        TEXT,
    size        DECIMAL,
    size_usd    DECIMAL,
    entry_price DECIMAL,
    exit_price  DECIMAL DEFAULT 0,
    closed_pnl  DECIMAL DEFAULT 0,
    leverage    DECIMAL DEFAULT 1,
    timestamp   TEXT,
    signal_id   BIGINT
);

-- DEMO

CREATE TABLE IF NOT EXISTS demo_balance (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID REFERENCES users(id),
    section    TEXT,
    balance    DECIMAL DEFAULT 10000,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, section)
);

CREATE TABLE IF NOT EXISTS demo_trades (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID REFERENCES users(id),
    section       TEXT,
    pair          TEXT,
    direction     TEXT,
    entry_price   DECIMAL,
    current_price DECIMAL DEFAULT 0,
    size_usd      DECIMAL,
    stop_loss     DECIMAL DEFAULT 0,
    take_profit   DECIMAL DEFAULT 0,
    pnl           DECIMAL DEFAULT 0,
    status        TEXT DEFAULT 'open',
    opened_at     TIMESTAMPTZ DEFAULT NOW(),
    closed_at     TIMESTAMPTZ,
    close_reason  TEXT
);

-- SOLANA / DEGEN

CREATE TABLE IF NOT EXISTS solana_wallets (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID REFERENCES users(id),
    public_key   TEXT,
    label        TEXT DEFAULT '',
    wallet_index INT DEFAULT 0,
    is_active    BOOL DEFAULT true,
    last_synced  TIMESTAMPTZ,
    UNIQUE(user_id, public_key)
);

CREATE TABLE IF NOT EXISTS sol_positions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    token_address   TEXT,
    token_symbol    TEXT,
    wallet_index    INT DEFAULT 0,
    tokens_held     DECIMAL,
    cost_basis      DECIMAL,
    entry_price     DECIMAL,
    current_price   DECIMAL DEFAULT 0,
    realised_pnl    DECIMAL DEFAULT 0,
    unrealised_pnl  DECIMAL DEFAULT 0,
    status          TEXT DEFAULT 'open',
    opened_at       TIMESTAMPTZ DEFAULT NOW(),
    closed_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auto_sell_configs (
    id                BIGSERIAL PRIMARY KEY,
    user_id           UUID REFERENCES users(id),
    token_address     TEXT,
    token_symbol      TEXT,
    wallet_type       TEXT DEFAULT 'live',
    entry_price       DECIMAL,
    stop_loss_pct     DECIMAL DEFAULT 20,
    tp1_pct           DECIMAL DEFAULT 50,
    tp1_sell_pct      DECIMAL DEFAULT 25,
    tp2_pct           DECIMAL DEFAULT 100,
    tp2_sell_pct      DECIMAL DEFAULT 25,
    tp3_pct           DECIMAL DEFAULT 200,
    tp3_sell_pct      DECIMAL DEFAULT 50,
    trailing_stop_pct DECIMAL,
    trailing_high     DECIMAL,
    tp1_hit           BOOL DEFAULT false,
    tp2_hit           BOOL DEFAULT false,
    tp3_hit           BOOL DEFAULT false,
    sl_hit            BOOL DEFAULT false,
    active            BOOL DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token_address)
);

CREATE TABLE IF NOT EXISTS degen_models (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             UUID REFERENCES users(id),
    name                TEXT,
    description         TEXT DEFAULT '',
    active              BOOL DEFAULT false,
    min_score           DECIMAL DEFAULT 65,
    min_mcap_usd        DECIMAL DEFAULT 0,
    max_mcap_usd        DECIMAL DEFAULT 10000000,
    min_liquidity_usd   DECIMAL DEFAULT 10000,
    max_age_minutes     INT DEFAULT 1440,
    min_holder_count    INT DEFAULT 50,
    max_rug_score       DECIMAL DEFAULT 50,
    position_size_usd   DECIMAL DEFAULT 50,
    auto_buy            BOOL DEFAULT false,
    auto_buy_threshold  DECIMAL DEFAULT 80,
    signals_today       INT DEFAULT 0,
    total_signals       INT DEFAULT 0,
    is_preset           BOOL DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracked_wallets (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    wallet_address  TEXT,
    label           TEXT DEFAULT '',
    copy_pct        DECIMAL DEFAULT 100,
    max_copy_usd    DECIMAL DEFAULT 50,
    auto_mirror     BOOL DEFAULT false,
    active          BOOL DEFAULT true,
    last_tx_sig     TEXT,
    win_rate        DECIMAL DEFAULT 0,
    total_copies    INT DEFAULT 0,
    pnl_from_copies DECIMAL DEFAULT 0,
    added_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, wallet_address)
);

CREATE TABLE IF NOT EXISTS blacklist (
    id       BIGSERIAL PRIMARY KEY,
    user_id  UUID REFERENCES users(id),
    address  TEXT,
    type     TEXT DEFAULT 'token',
    reason   TEXT DEFAULT '',
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, address)
);

CREATE TABLE IF NOT EXISTS solana_watchlist (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID REFERENCES users(id),
    token_address TEXT,
    symbol        TEXT,
    target_price  DECIMAL,
    notes         TEXT DEFAULT '',
    added_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token_address)
);

-- POLYMARKET / PREDICTIONS

CREATE TABLE IF NOT EXISTS prediction_models (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              UUID REFERENCES users(id),
    name                 TEXT,
    description          TEXT DEFAULT '',
    active               BOOL DEFAULT false,
    position_type        TEXT DEFAULT 'both',
    min_yes_pct          DECIMAL DEFAULT 20,
    max_yes_pct          DECIMAL DEFAULT 80,
    min_volume_24h       DECIMAL DEFAULT 10000,
    min_liquidity        DECIMAL DEFAULT 5000,
    min_days_to_resolve  INT DEFAULT 1,
    max_days_to_resolve  INT DEFAULT 30,
    min_size_usd         DECIMAL DEFAULT 10,
    max_size_usd         DECIMAL DEFAULT 100,
    min_passing_score    DECIMAL DEFAULT 60,
    auto_trade           BOOL DEFAULT false,
    auto_trade_threshold DECIMAL DEFAULT 75,
    signals_today        INT DEFAULT 0,
    total_signals        INT DEFAULT 0,
    win_rate             DECIMAL DEFAULT 0,
    is_preset            BOOL DEFAULT false,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poly_live_trades (
    id             BIGSERIAL PRIMARY KEY,
    user_id        UUID REFERENCES users(id),
    market_id      TEXT,
    question       TEXT,
    position       TEXT,
    token_id       TEXT,
    entry_price    DECIMAL,
    current_price  DECIMAL DEFAULT 0,
    size_usd       DECIMAL,
    shares         DECIMAL DEFAULT 0,
    pnl_usd        DECIMAL DEFAULT 0,
    order_id       TEXT,
    status         TEXT DEFAULT 'open',
    opened_at      TIMESTAMPTZ DEFAULT NOW(),
    closed_at      TIMESTAMPTZ,
    outcome        TEXT,
    resolution_pnl DECIMAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poly_watchlist (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID REFERENCES users(id),
    condition_id TEXT,
    question     TEXT,
    alert_above  DECIMAL,
    alert_below  DECIMAL,
    notes        TEXT DEFAULT '',
    added_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, condition_id)
);

-- BACKTESTING

CREATE TABLE IF NOT EXISTS backtest_runs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    name            TEXT,
    model_id        BIGINT,
    model_snapshot  JSONB,
    pair            TEXT,
    timeframe       TEXT,
    start_date      DATE,
    end_date        DATE,
    initial_capital DECIMAL DEFAULT 10000,
    status          TEXT DEFAULT 'pending',
    total_trades    INT DEFAULT 0,
    win_rate        DECIMAL DEFAULT 0,
    total_pnl       DECIMAL DEFAULT 0,
    max_drawdown    DECIMAL DEFAULT 0,
    avg_rr          DECIMAL DEFAULT 0,
    sharpe_ratio    DECIMAL DEFAULT 0,
    profit_factor   DECIMAL DEFAULT 0,
    results_data    JSONB DEFAULT '{}',
    error           TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backtest_trades (
    id            BIGSERIAL PRIMARY KEY,
    run_id        BIGINT
                  REFERENCES backtest_runs(id),
    user_id       UUID REFERENCES users(id),
    entry_time    TIMESTAMPTZ,
    exit_time     TIMESTAMPTZ,
    pair          TEXT,
    direction     TEXT,
    entry_price   DECIMAL,
    exit_price    DECIMAL DEFAULT 0,
    size_usd      DECIMAL,
    pnl           DECIMAL DEFAULT 0,
    pnl_pct       DECIMAL DEFAULT 0,
    phase_reached INT,
    rules_passed  JSONB,
    exit_reason   TEXT
);

-- ANALYTICS & EXTRAS

CREATE TABLE IF NOT EXISTS price_alerts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    section         TEXT,
    token_address   TEXT,
    coin            TEXT,
    condition       TEXT,
    target_price    DECIMAL,
    current_price   DECIMAL DEFAULT 0,
    triggered       BOOL DEFAULT false,
    recurring       BOOL DEFAULT false,
    notify_telegram BOOL DEFAULT true,
    notify_email    BOOL DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID REFERENCES users(id),
    title      TEXT,
    body       TEXT,
    section    TEXT,
    trade_id   BIGINT,
    signal_id  BIGINT,
    tags       JSONB DEFAULT '[]',
    ai_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_insights (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID REFERENCES users(id),
    period       TEXT,
    section      TEXT,
    insight      TEXT,
    patterns     JSONB DEFAULT '[]',
    suggestions  JSONB DEFAULT '[]',
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_signals (
    id             BIGSERIAL PRIMARY KEY,
    source_user_id UUID REFERENCES users(id),
    section        TEXT,
    pair           TEXT,
    direction      TEXT,
    timeframe      TEXT,
    quality_grade  TEXT,
    quality_score  DECIMAL,
    signal_data    JSONB DEFAULT '{}',
    subscribers    INT DEFAULT 0,
    win_rate       DECIMAL DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    expires_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS signal_subscriptions (
    id             BIGSERIAL PRIMARY KEY,
    subscriber_id  UUID REFERENCES users(id),
    source_user_id UUID REFERENCES users(id),
    section        TEXT,
    active         BOOL DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subscriber_id, source_user_id, section)
);
