-- Admin + subscription setup for existing Edge-Lab schema.
-- Run this in Supabase SQL Editor.

BEGIN;

-- 1) Users: role/admin flags
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS is_admin BOOL NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON public.users(subscription_tier);

-- 2) Ensure canonical tiers exist
INSERT INTO public.subscription_tiers
    (name, price_monthly, price_yearly,
     max_wallets_per_section, max_daily_alerts,
     scanner_interval_mins, can_live_trade, can_backtest,
     can_ai_analysis, can_copy_signals, signal_delay_mins)
VALUES
    ('free', 0, 0, 1, 5, 30, false, false, false, false, 15),
    ('pro', 29, 290, 5, 999, 5, true, true, false, false, 0),
    ('premium', 79, 790, 999, 999, 5, true, true, true, true, 0)
ON CONFLICT (name) DO UPDATE
SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    max_wallets_per_section = EXCLUDED.max_wallets_per_section,
    max_daily_alerts = EXCLUDED.max_daily_alerts,
    scanner_interval_mins = EXCLUDED.scanner_interval_mins,
    can_live_trade = EXCLUDED.can_live_trade,
    can_backtest = EXCLUDED.can_backtest,
    can_ai_analysis = EXCLUDED.can_ai_analysis,
    can_copy_signals = EXCLUDED.can_copy_signals,
    signal_delay_mins = EXCLUDED.signal_delay_mins;

COMMIT;

-- 3) Make one user admin (replace with your email)
-- UPDATE public.users
-- SET role = 'admin', is_admin = true
-- WHERE email = 'you@example.com';
