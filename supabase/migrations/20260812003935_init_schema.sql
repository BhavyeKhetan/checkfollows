-- CheckFollows Initial Schema
-- Tables: instagram_targets, subscriptions, scans, follow_snapshots, follow_events

-- ─── Instagram Targets ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instagram_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  following_count INTEGER NOT NULL DEFAULT 0,
  follower_count INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  next_scan_at TIMESTAMPTZ,
  scan_interval_hours INTEGER NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_targets_next_scan
  ON public.instagram_targets (next_scan_at)
  WHERE next_scan_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instagram_targets_username
  ON public.instagram_targets (LOWER(username));

-- ─── Subscriptions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_id, email)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_email
  ON public.subscriptions (email);

CREATE INDEX IF NOT EXISTS idx_subscriptions_target
  ON public.subscriptions (target_id);

-- ─── Scans ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  provider TEXT NOT NULL DEFAULT 'hikerapi',
  api_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_target
  ON public.scans (target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scans_status
  ON public.scans (status);

-- ─── Follow Snapshots ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('following', 'followers')),
  account_ids TEXT[] NOT NULL DEFAULT '{}',
  account_usernames TEXT[] NOT NULL DEFAULT '{}',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_follow_snapshots_target
  ON public.follow_snapshots (target_id, snapshot_type, captured_at DESC);

-- ─── Follow Events ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('NEW_FOLLOWING', 'STOPPED_FOLLOWING', 'NEW_FOLLOWER', 'LOST_FOLLOWER')),
  instagram_id TEXT NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  previous_snapshot_id UUID REFERENCES public.follow_snapshots(id) ON DELETE SET NULL,
  current_snapshot_id UUID NOT NULL REFERENCES public.follow_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_follow_events_target
  ON public.follow_events (target_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_events_confirmed
  ON public.follow_events (target_id, event_type, confirmed)
  WHERE confirmed = true;

-- ─── RLS: Enable on all tables ───────────────────────────
ALTER TABLE public.instagram_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_events ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ────────────────────────────────────────
CREATE POLICY "Anyone can read targets"
  ON public.instagram_targets FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read subscriptions"
  ON public.subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read scans"
  ON public.scans FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read snapshots"
  ON public.follow_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read events"
  ON public.follow_events FOR SELECT
  USING (true);

-- ─── Grant API access ────────────────────────────────────
GRANT SELECT ON public.instagram_targets TO anon, authenticated;
GRANT SELECT ON public.subscriptions TO anon, authenticated;
GRANT SELECT ON public.scans TO anon, authenticated;
GRANT SELECT ON public.follow_snapshots TO anon, authenticated;
GRANT SELECT ON public.follow_events TO anon, authenticated;

GRANT ALL ON public.instagram_targets TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.scans TO service_role;
GRANT ALL ON public.follow_snapshots TO service_role;
GRANT ALL ON public.follow_events TO service_role;

-- ─── Updated_at trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_instagram_targets_updated_at ON public.instagram_targets;
CREATE TRIGGER trg_instagram_targets_updated_at
  BEFORE UPDATE ON public.instagram_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
