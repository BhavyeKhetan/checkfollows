-- Add monitoring + Apify cost instrumentation fields
-- Migration: add_monitoring_apify_fields created 2026-08-12

-- 1. instagram_targets: add monitoring_enabled
ALTER TABLE public.instagram_targets
  ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.instagram_targets
  ADD COLUMN IF NOT EXISTS monitoring_interval_hours INTEGER NOT NULL DEFAULT 24;

-- 2. scans: add cost instrumentation + suspect flag
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS suspect BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS profiles_returned INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS actor_id TEXT;

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS run_id TEXT;

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS target_count INTEGER NOT NULL DEFAULT 1;

-- 3. Notification events table (for email/push alert tracking)
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.instagram_targets(id) ON DELETE CASCADE,
  follow_event_id UUID NOT NULL REFERENCES public.follow_events(id) ON DELETE CASCADE,
  subscriber_email TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  UNIQUE(follow_event_id, subscriber_email, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_target
  ON public.notification_events (target_id);

-- RLS + grants for notification_events
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notification_events"
  ON public.notification_events FOR SELECT
  USING (true);

GRANT SELECT ON public.notification_events TO anon, authenticated;
GRANT ALL ON public.notification_events TO service_role;

-- 4. Update scans.provider default to 'apify'
ALTER TABLE public.scans ALTER COLUMN provider SET DEFAULT 'apify';
