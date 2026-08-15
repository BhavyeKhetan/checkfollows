---
name: content-intelligence-loop
description: Weekly autonomous content intelligence loop. GitHub Actions runs deterministic PostHog + GSC provider reads, scoring, topic planning, validation, commit, and push. OpenClaw is used only for staged per-post drafting after deterministic inputs exist. State lives in growth/content-intelligence/.
---

# Content Intelligence Loop

Weekly autonomous blog generation loop for CheckFollows.

## Indexing-first operating rule

The weekly loop exists to grow indexed, traffic-bearing blog inventory, not to hit a
raw article quota.

- Treat `growth/content-intelligence/state/learning-insights.json` `persistentPatterns`
  as hard gates, not soft guidance.
- Treat `references/indexing-copy-patterns.md` as a hard quality gate.
- Bias toward factual, detection-oriented topics that name a specific Instagram surface:
  following list, follower list, recent follows, unfollows, notifications, mutuals, trackers.
- Reject emotional validation, generic relationship advice, or debate-framed topics
  unless they anchor to a specific Instagram surface or tool.
- If fewer candidates survive the hard filters, generate fewer posts. Do not backfill
  with low-signal topics just to hit quota.
- Prefer categories that have already shown indexing traction: `how-to`, `platforms`,
  `guides`, and tightly scoped `compare` topics anchored to a named tool.

## Modes

### `collect` — Pull performance data
Deterministic provider scripts (PostHog, GSC) run with GitHub secrets. Raw outputs land
in `growth/content-intelligence/raw/`. When a provider is not yet configured, the script
writes an empty fallback and the planner falls back to the seed topic pool
(`growth/content-intelligence/topic-pool.json`).

### `score` — Score posts and find opportunities
`npx tsx scripts/content-intelligence/compute-scores.ts` scores the inventory from raw
provider data and writes `analysis/YYYY-MM-DD.json`.

### `plan` — Select topics
`npx tsx scripts/content-intelligence/plan-topics.ts --date YYYY-MM-DD` mines GSC
queries (or falls back to the seed topic pool), applies hard filters + dedup, and writes
`analysis/topics-YYYY-MM-DD.json`.

### `draft` — Write new posts
For each approved topic, OpenClaw is called once with a narrow schema and returns a
complete `BlogPost` data object, which is appended to `src/lib/blog-posts.ts`.

### `validate` — Run quality gates
`validate-posts.ts` checks all 10 gates, then sitemap + llms indexes are regenerated
and validated.

### `run` — Full weekly orchestration
`preflight → collect → score → plan → draft → validate` then policy write-back.

## State files

| File | Purpose |
|---|---|
| `config.json` | Weights, thresholds, targets |
| `topic-pool.json` | Deterministic seed topics used until GSC is available |
| `state/cumulative-performance.json` | Rolling per-slug scores over time |
| `state/topic-registry.json` | All written + rejected topics for dedup |
| `state/learning-insights.json` | Weekly winning patterns + recommendations |
| `raw/posthog-YYYY-MM-DD.json` | Raw PostHog pull |
| `raw/gsc-YYYY-MM-DD.json` | Raw GSC pull |
| `raw/gsc-indexing-YYYY-MM-DD.json` | Raw URL Inspection coverage states |
| `analysis/YYYY-MM-DD.json` | Scored posts, underperformers, top performers |
| `analysis/topics-YYYY-MM-DD.json` | Selected topics for the week |
| `logs/YYYY-MM-DD-openclaw.json` | Execution log |

## Quality gates
See `references/quality-gates.md`. All 10 gates must pass before commit.

## Learning loop
See `references/learning-loop.md`. The loop tracks what categories, formats, and keyword
patterns produce the highest composite scores, then uses `persistentPatterns` as hard
topic gates and `weeklyInsights` as soft ranking bias.
