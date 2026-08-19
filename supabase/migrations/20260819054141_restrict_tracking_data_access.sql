-- Tracking history and billing records are private application data. All
-- access goes through authenticated server routes using the service role.
-- Removing browser-role grants also protects these tables if a permissive RLS
-- policy is accidentally introduced later.

DROP POLICY IF EXISTS "Anyone can read targets" ON public.instagram_targets;
DROP POLICY IF EXISTS "Anyone can read subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Anyone can read scans" ON public.scans;
DROP POLICY IF EXISTS "Anyone can read snapshots" ON public.follow_snapshots;
DROP POLICY IF EXISTS "Anyone can read events" ON public.follow_events;

REVOKE ALL PRIVILEGES ON TABLE public.instagram_targets FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.subscriptions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.scans FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.follow_snapshots FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.follow_events FROM anon, authenticated;
