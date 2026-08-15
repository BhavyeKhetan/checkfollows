# Weekly Trigger Contract

GitHub Actions owns scheduling, provider reads, deterministic analysis, repo file
writes, validation, commit, push, and search submission. OpenClaw owns only narrow LLM
drafting after deterministic inputs exist.

## Pipeline

1. `preflight` — verify OpenClaw; PostHog/GSC are optional and degrade to the seed pool.
2. `collect` — run `pull-posthog-blog.ts`, `pull-gsc.ts`, `pull-gsc-indexing.ts`.
3. `score` — run `compute-scores.ts`.
4. `plan` — run `plan-topics.ts --date YYYY-MM-DD`. Falls back to `topic-pool.json` when
   no GSC data exists. Fails if no publishable topics survive hard filters.
5. `draft` — call OpenClaw once per new topic. Each call returns a complete BlogPost
   data object through a narrow JSON schema.
6. `validate` — run post validation, sitemap verification, and llms regeneration/validation.
7. `publish` — `npm run automation:policy -- weekly-content-intelligence --write-back`
   (autoship_main).
8. `submit` — `npm run automation:submit-latest-content` (GSC sitemap + IndexNow, skipped
   until configured).

## Scheduler

Cron expression: `0 8 * * 4` (Thursday 8am UTC) — offset from Content History's Monday run.
Scheduler: `.github/workflows/weekly-content-intelligence-openclaw.yml`

## Required GitHub Secrets

- `OPENCLAW_API_URL`
- `OPENCLAW_API_KEY`

Optional until wired up: `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST`,
`GSC_SERVICE_ACCOUNT_JSON`, `GSC_SITE_URL`, `GSC_URL_INSPECTION_DELAY_MS`,
`GSC_URL_INSPECTION_LIMIT`, `INDEXNOW_KEY`.

## Publish Contract

A green scheduled run must produce at least one `newSlug` in
`growth/content-intelligence/logs/YYYY-MM-DD-openclaw.json`. Blocked runs must fail
before policy write-back instead of committing a no-op success log.
