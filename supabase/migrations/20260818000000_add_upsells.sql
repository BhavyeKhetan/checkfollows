-- One-time upsell purchases: history export, on-demand rescan credits, and
-- mutual-follows reports. Each row is a purchased credit that can be consumed.
-- Credits are credited server-side (service role) after Stripe confirms payment.
CREATE TABLE IF NOT EXISTS public.one_time_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,              -- 'export' | 'rescan_credits' | 'mutuals'
  target_id UUID,
  credits INTEGER NOT NULL DEFAULT 1,
  consumed INTEGER NOT NULL DEFAULT 0,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_one_time_purchases_user
  ON public.one_time_purchases (user_id, kind);

ALTER TABLE public.one_time_purchases ENABLE ROW LEVEL SECURITY;

-- Written server-side via the service role only; no anon access.
GRANT ALL ON public.one_time_purchases TO service_role;

-- Suspicious-spike threshold: alert a subscriber when a target follows >= N
-- accounts in a single scan. Default 5. User-configurable.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS spike_threshold INTEGER NOT NULL DEFAULT 5;
