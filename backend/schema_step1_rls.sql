-- STEP 1 - RLS
-- Run this file second in Supabase SQL Editor, after schema_step1.sql.
-- This enables RLS and creates owner-only policies for user-scoped tables.

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_stop ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hl_trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE solana_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sol_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_sell_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE degen_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE solana_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE poly_live_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE poly_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_subscriptions ENABLE ROW LEVEL SECURITY;

-- users (own row only)
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_insert_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;
DROP POLICY IF EXISTS users_delete_own ON users;
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_insert_own ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY users_delete_own ON users FOR DELETE USING (auth.uid() = id);

-- Generic user_id owner policies
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'encrypted_keys',
        'audit_log',
        'emergency_stop',
        'user_settings',
        'risk_settings',
        'pending_signals',
        'models',
        'hl_positions',
        'hl_orders',
        'hl_trade_history',
        'demo_balance',
        'demo_trades',
        'solana_wallets',
        'sol_positions',
        'auto_sell_configs',
        'degen_models',
        'tracked_wallets',
        'blacklist',
        'solana_watchlist',
        'prediction_models',
        'poly_live_trades',
        'poly_watchlist',
        'backtest_runs',
        'backtest_trades',
        'price_alerts',
        'journal_entries',
        'ai_insights'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_select_own ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I_insert_own ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I_update_own ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I_delete_own ON %I', t, t);

        EXECUTE format('CREATE POLICY %I_select_own ON %I FOR SELECT USING (auth.uid() = user_id)', t, t);
        EXECUTE format('CREATE POLICY %I_insert_own ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', t, t);
        EXECUTE format('CREATE POLICY %I_update_own ON %I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t, t);
        EXECUTE format('CREATE POLICY %I_delete_own ON %I FOR DELETE USING (auth.uid() = user_id)', t, t);
    END LOOP;
END $$;

-- public_signals (owner is source_user_id)
DROP POLICY IF EXISTS public_signals_select_own ON public_signals;
DROP POLICY IF EXISTS public_signals_insert_own ON public_signals;
DROP POLICY IF EXISTS public_signals_update_own ON public_signals;
DROP POLICY IF EXISTS public_signals_delete_own ON public_signals;
CREATE POLICY public_signals_select_own ON public_signals FOR SELECT USING (auth.uid() = source_user_id);
CREATE POLICY public_signals_insert_own ON public_signals FOR INSERT WITH CHECK (auth.uid() = source_user_id);
CREATE POLICY public_signals_update_own ON public_signals FOR UPDATE USING (auth.uid() = source_user_id) WITH CHECK (auth.uid() = source_user_id);
CREATE POLICY public_signals_delete_own ON public_signals FOR DELETE USING (auth.uid() = source_user_id);

-- signal_subscriptions (owner is subscriber_id)
DROP POLICY IF EXISTS signal_subscriptions_select_own ON signal_subscriptions;
DROP POLICY IF EXISTS signal_subscriptions_insert_own ON signal_subscriptions;
DROP POLICY IF EXISTS signal_subscriptions_update_own ON signal_subscriptions;
DROP POLICY IF EXISTS signal_subscriptions_delete_own ON signal_subscriptions;
CREATE POLICY signal_subscriptions_select_own ON signal_subscriptions FOR SELECT USING (auth.uid() = subscriber_id);
CREATE POLICY signal_subscriptions_insert_own ON signal_subscriptions FOR INSERT WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY signal_subscriptions_update_own ON signal_subscriptions FOR UPDATE USING (auth.uid() = subscriber_id) WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY signal_subscriptions_delete_own ON signal_subscriptions FOR DELETE USING (auth.uid() = subscriber_id);

-- Backend service role bypasses RLS.
