-- Track when a subscriber removes an Instagram account from their dashboard.
-- Basic plans may remove at most once every 7 days; Premium is unrestricted.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_removed_at
  ON public.subscriptions (user_id, removed_at DESC)
  WHERE removed_at IS NOT NULL;
