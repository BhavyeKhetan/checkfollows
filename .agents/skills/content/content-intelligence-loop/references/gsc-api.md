# Google Search Console API

Used by `scripts/content-intelligence/pull-gsc.ts` (Search Analytics) and
`pull-gsc-indexing.ts` (URL Inspection).

## Authentication

Service account JSON via `GSC_SERVICE_ACCOUNT_JSON` (GitHub secret) or a local file at
`credentials/gsc-service-account.json` (via `GOOGLE_SERVICE_ACCOUNT_PATH`).

Scopes:
- `https://www.googleapis.com/auth/webmasters.readonly` (reads + URL Inspection)

## Site URL

`GSC_SITE_URL` — the property, e.g. `https://checkfollows.com/`.

## Key outputs

- `pull-gsc.ts` → `raw/gsc-YYYY-MM-DD.json` with per-page clicks, impressions, CTR,
  position, and top queries (last 30 days).
- `pull-gsc-indexing.ts` → `raw/gsc-indexing-YYYY-MM-DD.json` with per-URL coverage
  states (`Submitted and indexed`, `Crawled - currently not indexed`,
  `Discovered - currently not indexed`, `URL is unknown to Google`).

## Rate limits

`GSC_URL_INSPECTION_DELAY_MS` (default 650) spaces URL Inspection calls.
`GSC_URL_INSPECTION_LIMIT` caps the number of URLs inspected per run.
