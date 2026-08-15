# Mixpanel Blog Queries

`scripts/content-intelligence/pull-mixpanel-blog.ts` pulls per-blog-slug metrics from
Mixpanel via the Export API (`https://data.mixpanel.com/api/2.0/export`) and aggregates
them deterministically in Node. This replaced the retired PostHog puller.

## Credentials

Read-back requires a Mixpanel **service account** — the public project token
(`NEXT_PUBLIC_MIXPANEL_TOKEN`) is ingestion-only and cannot read data.

- `MIXPANEL_SERVICE_ACCOUNT_USERNAME` (service account username)
- `MIXPANEL_SERVICE_ACCOUNT_SECRET` (service account secret)

Authentication is HTTP Basic auth (`username:secret`).

## Metrics pulled (last 30 days)

- `pageviews7d`, `pageviews30d`, `uniqueVisitors30d` — from `blog_post_viewed` events,
  grouped by `properties.slug`.
- `funnelEntries`, `funnelConversions`, `conversionRate` — per `distinct_id`, the first
  `blog_post_viewed` is the entry slug; a later `sign_up_completed` or
  `subscription_activated` marks conversion.
- `avgSessionDuration` is currently `0` (no session-duration instrumentation yet); it
  remains in the schema for `compute-scores.ts` compatibility.

## Input event

The blog page fires `blog_post_viewed` with `{ slug, title, category, source: "blog" }`
via `src/components/analytics/blog-view-tracker.tsx`.

## Output

`raw/mixpanel-YYYY-MM-DD.json` with `{ slugs: { "<slug>": {...} } }`.

When the service account is not configured, the script writes an empty fallback so the
weekly loop still runs against the seed topic pool.
