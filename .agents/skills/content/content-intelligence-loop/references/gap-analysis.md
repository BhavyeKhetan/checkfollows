# Gap Analysis — Topic Selection Methodology

## Inputs

1. `raw/gsc-YYYY-MM-DD.json` — queries with high impressions but low CTR
2. `raw/gsc-indexing-YYYY-MM-DD.json` — URL Inspection coverage states
3. `analysis/YYYY-MM-DD.json` — scored posts + index coverage summaries
4. `state/learning-insights.json` — winning categories and patterns
5. `state/topic-registry.json` — existing + rejected topics for dedup
6. `topic-pool.json` — deterministic seed topics (fallback when GSC is absent)
7. `references/indexing-copy-patterns.md` — indexed/not-indexed copy-shape rules

## Step 1: GSC query mining
Find queries where `impressions > 50` AND `ctr < 0.02` (high visibility, low click-through).

## Step 2: Seed pool fallback
When no GSC queries are available (pre-Google-validation phase), mine `topic-pool.json`.

## Step 3: Apply winning patterns (HARD filters)
For EVERY candidate:
1. Must name a specific Instagram surface or tool (following list, follower list,
   notifications, trackers, etc.). Reject generic relationship-category pages.
2. Must match a factual query shape with one verifiable answer.
3. Must NOT match banned patterns: emotional self-validation, broad relationship advice,
   opinion/debate framings.

## Step 4: Dedup each candidate
`dedup-checker.ts` — reject if similarity > 0.70.

## Step 5: Rank and select
Rank by `estimatedOpportunity` and select up to the weekly cap.

## Step 6: Refresh target selection
From `analysis/YYYY-MM-DD.json`, filter to bottom percentile of mature posts with enough
impressions, exclude recently refreshed, and pick the worst with per-component diagnosis.

## Output
Write to `analysis/topics-YYYY-MM-DD.json`:
```json
{
  "date": "YYYY-MM-DD",
  "newTopics": [
    { "rank": 1, "title": "...", "keyword": "...", "category": "...",
      "gapReason": "...", "suggestedFormat": "...", "relatedSlugs": [...] }
  ],
  "refreshTargets": [
    { "slug": "...", "currentScore": 12.3, "refreshReason": "...",
      "suggestedChanges": [...] }
  ]
}
```
