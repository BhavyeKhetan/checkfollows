-- Capture funnel emails before payment so no lead is lost if a visitor
-- abandons the paywall. Relationship is stored on the Stripe subscription
-- metadata (and can be backfilled here later).
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  username TEXT,
  target_id UUID,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads (email);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Leads are written server-side via the service role only; no anon access.
GRANT ALL ON public.leads TO service_role;
