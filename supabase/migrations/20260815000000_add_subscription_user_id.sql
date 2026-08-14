-- Link a subscription to a Supabase auth user.
-- Set at signup (matched by email) and used as the entitlement key
-- for gating searches / tracking behind an authenticated account.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id)
  WHERE user_id IS NOT NULL;
