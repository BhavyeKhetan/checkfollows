-- Hourly monitoring scheduler via Supabase pg_cron + pg_net.
--
-- Vercel Cron is limited to one run/day on this plan, so the *hourly*
-- scheduler that picks up due targets (next_scan_at <= now) lives here in
-- Supabase instead. The daily Vercel cron remains as a safety net; both are
-- safe to overlap because processDueScans() atomically claims due targets.
--
-- NOTE 1: psql does NOT substitute :'var' inside dollar-quoted strings, so we
-- build the cron command with format() — the variables are passed as separate
-- arguments, outside any quoting.
--
-- NOTE 2: net.http_post signature is (url, body, params, headers, timeout).
-- The Authorization header must be the 4th argument (3rd is query params).
--
-- Apply with (secrets injected at apply time, never committed):
--   psql -v cron_secret='...' -v monitor_url='https://www.checkfollows.com/api/cron/monitor' \
--        -f supabase/migrations/20260816000000_add_hourly_monitor_cron.sql

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any previous version of this job before (re)scheduling.
select cron.unschedule('checkfollows-hourly-monitor')
where exists (select 1 from cron.job where jobname = 'checkfollows-hourly-monitor');

select cron.schedule(
  'checkfollows-hourly-monitor',
  '0 * * * *',
  format(
    'select net.http_post(%L, ''{}''::jsonb, ''{}''::jsonb, jsonb_build_object(''Authorization'', ''Bearer %s'', ''Content-Type'', ''application/json''))',
    :'monitor_url',
    :'cron_secret'
  )
);
