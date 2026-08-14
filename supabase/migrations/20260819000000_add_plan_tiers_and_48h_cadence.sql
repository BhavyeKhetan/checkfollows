-- Add plan tiers (base/premium) and switch monitoring cadence to 48 hours
-- Migration: add_plan_tiers_and_48h_cadence

-- 1. subscriptions.tier — base = 3 accounts total ever, premium = unlimited (5 at a time)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'base';

CREATE INDEX IF NOT EXISTS idx_subscriptions_tier
  ON public.subscriptions (tier);

-- 2. Monitoring cadence: every other day (48h) instead of daily (24h)
ALTER TABLE public.instagram_targets
  ALTER COLUMN scan_interval_hours SET DEFAULT 48;

ALTER TABLE public.instagram_targets
  ALTER COLUMN monitoring_interval_hours SET DEFAULT 48;
