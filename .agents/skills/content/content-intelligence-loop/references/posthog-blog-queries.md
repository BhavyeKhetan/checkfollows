# PostHog Blog Queries

`scripts/content-intelligence/pull-posthog-blog.ts` pulls per-blog-slug metrics from
PostHog via the Query API (`POSTHOG_HOST/api/projects/{id}/query/`).

## Credentials

- `POSTHOG_PERSONAL_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_HOST` (default `https://us.i.posthog.com`)

## Metrics pulled (last 30 days)

- `pageviews7d`, `pageviews30d`, `uniqueVisitors30d`
- `avgSessionDuration`
- `funnelEntries`, `funnelConversions`, `conversionRate`

Funnel conversion events are the product's key actions (in Content History they are
`scan_started`, `signup_completed`, `payment_received`; for CheckFollows, map to the
track/signup/payment events actually emitted by the app).

## Output

`raw/posthog-YYYY-MM-DD.json` with `{ slugs: { "<slug>": {...} } }`.

When PostHog is not configured, the script writes an empty fallback so the weekly loop
still runs against the seed topic pool.
