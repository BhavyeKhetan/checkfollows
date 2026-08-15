# Composite Score Formula

```
compositeScore = (0.40 * funnelScore) + (0.30 * gscScore) + (0.30 * engagementScore)
```

## Component scores (percentile-ranked 0-100)

### funnelScore
`percentileRank(conversionRate)` — users who entered via this blog post and completed a
track/signup/payment, divided by total entries from this post.

### gscScore
`(0.6 * impressionsPercentile) + (0.4 * ctrPercentile)` — heavier on impressions.

### engagementScore
`(0.5 * pageviewsPercentile) + (0.5 * avgSessionDurationPercentile)`.

## Infant posts (< 21 days old)

No GSC data yet. Score redistributed:
```
infantScore = (0.57 * funnelScore) + (0.43 * engagementScore)
```

Infant posts are scored but flagged `maturity: "infant"`, excluded from underperformer
selection and winning-pattern extraction, and preserved for retroactive comparison.

## Normalization

Percentile rank across all scored posts in the current run.
