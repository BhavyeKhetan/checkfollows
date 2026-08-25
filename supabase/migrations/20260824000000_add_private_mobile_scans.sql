-- Private Instagram mobile scans (iPhone Safari Shortcut path).
--
-- Critical tenancy rule: Shortcut-submitted private membership data is
-- USER-SCOPED and must never leak into the global target-centric model.
-- A malicious/modified Shortcut can only ever poison its own owner's
-- private timeline, never another subscriber's.
--
-- Access model (matches 20260819054141_restrict_tracking_data_access.sql):
--   - RLS enabled with NO policies → default deny for anon + authenticated.
--   - All reads/writes go through trusted server routes using service role.

-- ─── Private scan jobs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.private_scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'failed', 'expired')),
  requested_lists TEXT[] NOT NULL DEFAULT '{followers,following}'
    CHECK (requested_lists <@ '{followers,following}'::text[] AND array_length(requested_lists, 1) >= 1),
  viewer_instagram_id TEXT,
  viewer_username TEXT,
  shortcut_version TEXT,
  adapter_version TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  error_code TEXT,
  error_detail_safe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_scan_jobs_user_target
  ON public.private_scan_jobs (user_id, target_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_scan_jobs_open
  ON public.private_scan_jobs (user_id, target_id)
  WHERE status = 'open';

-- ─── Private scan page staging ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.private_scan_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.private_scan_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  list_type TEXT NOT NULL CHECK (list_type IN ('followers', 'following')),
  page_index INTEGER NOT NULL CHECK (page_index >= 0),
  request_cursor_hash TEXT,
  next_cursor_hash TEXT,
  terminal BOOLEAN NOT NULL DEFAULT false,
  raw_count INTEGER NOT NULL DEFAULT 0 CHECK (raw_count >= 0),
  unique_count INTEGER NOT NULL DEFAULT 0 CHECK (unique_count >= 0),
  page_hash TEXT NOT NULL,
  members JSONB NOT NULL DEFAULT '[]',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, list_type, page_index)
);

CREATE INDEX IF NOT EXISTS idx_private_scan_pages_job
  ON public.private_scan_pages (job_id, list_type, page_index);

-- ─── User-scoped private snapshots ─────────────────────────
CREATE TABLE IF NOT EXISTS public.private_follow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.private_scan_jobs(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('followers', 'following')),
  account_ids TEXT[] NOT NULL DEFAULT '{}',
  account_usernames TEXT[] NOT NULL DEFAULT '{}',
  set_hash TEXT NOT NULL,
  manifest JSONB NOT NULL DEFAULT '{}',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_id, snapshot_type)
);

CREATE INDEX IF NOT EXISTS idx_private_follow_snapshots_user_target
  ON public.private_follow_snapshots (user_id, target_id, captured_at DESC);

-- ─── User-scoped private events ────────────────────────────
CREATE TABLE IF NOT EXISTS public.private_follow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('NEW_FOLLOWING', 'STOPPED_FOLLOWING', 'NEW_FOLLOWER', 'LOST_FOLLOWER')),
  instagram_id TEXT NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  previous_snapshot_id UUID REFERENCES public.private_follow_snapshots(id) ON DELETE SET NULL,
  current_snapshot_id UUID NOT NULL REFERENCES public.private_follow_snapshots(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_follow_events_user_target
  ON public.private_follow_events (user_id, target_id, detected_at DESC);

-- ─── RLS: enable everywhere, define NO policies (default deny) ──
ALTER TABLE public.private_scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_scan_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_follow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_follow_events ENABLE ROW LEVEL SECURITY;

-- Defense in depth: even if a permissive policy is accidentally added later,
-- browser roles hold no grants on these tables at all.
REVOKE ALL PRIVILEGES ON TABLE public.private_scan_jobs FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.private_scan_pages FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.private_follow_snapshots FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.private_follow_events FROM anon, authenticated;

GRANT ALL ON public.private_scan_jobs TO service_role;
GRANT ALL ON public.private_scan_pages TO service_role;
GRANT ALL ON public.private_follow_snapshots TO service_role;
GRANT ALL ON public.private_follow_events TO service_role;
