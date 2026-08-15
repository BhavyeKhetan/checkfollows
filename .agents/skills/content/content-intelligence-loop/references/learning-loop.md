# Learning Loop

## What is compared week-over-week

1. Score deltas for the same posts across consecutive weeks
2. Cohort analysis: loop-generated (`generatedByLoop: true`) vs manually-written posts
3. Category performance: avg composite score per category
4. Format analysis: avg score by word count bucket, FAQ count, H2 count
5. Keyword pattern analysis: common structures in top-20 posts
6. Index coverage analysis: URL Inspection coverage states (indexed, crawled-not-indexed,
   discovered-not-indexed, unknown-to-Google)
7. Index copy-pattern analysis: copy features grouped by indexing outcome

## How winning patterns influence next week

`learning-insights.json` has two layers:

1. `persistentPatterns` are hard gates:
   - Candidate must name a specific Instagram surface or tool
   - Candidate must follow a factual query shape with a verifiable answer
   - Candidate must avoid emotional self-validation and opinion/debate framings
2. `weeklyInsights` are soft multipliers for the surviving pool:
   - Winning category: 1.3x boost
   - Winning keyword pattern: 1.2x boost
   - Indexed-page shape: prefer over same-score candidates

Quota is subordinate to fit. If only 7 candidates survive, generate 7 posts, not 12.

## Underperformer selection

1. Filter to mature posts (> 21 days old)
2. Filter to posts with >= 100 GSC impressions (enough signal)
3. Rank by composite score ascending
4. Exclude posts refreshed in the last 4 weeks
5. Take the bottom N with per-component diagnosis

## GSC lag handling

- Posts < 21 days: `maturity: "infant"`, PostHog-only scoring, never refreshed
- `URL is unknown to Google`: not learning evidence yet
- `Discovered - currently not indexed`: weak crawl-priority signal
- `Crawled - currently not indexed`: strongest negative example for topic/format selection

## State files

All learning state lives in `growth/content-intelligence/state/learning-insights.json`.
Each weekly entry includes top performing/indexed categories, avg score by category,
index coverage summaries, and human-readable recommendations. Kept indefinitely.
