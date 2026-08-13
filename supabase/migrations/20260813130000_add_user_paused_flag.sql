-- Distinguishes a user-initiated stop (user_paused = true) from an
-- entitlement lapse. When a user explicitly stops monitoring an account,
-- the webhook must NOT silently re-enable it on the next Stripe event.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS user_paused BOOLEAN NOT NULL DEFAULT false;
