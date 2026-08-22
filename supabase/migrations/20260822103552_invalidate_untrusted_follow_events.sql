-- Preserve bad provider-derived events for audit while removing them from all
-- customer-facing timelines, exports, counts, and confirmation processing.
ALTER TABLE public.follow_events
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invalidated_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_follow_events_valid_timeline
  ON public.follow_events (target_id, detected_at DESC)
  WHERE invalidated_at IS NULL;
