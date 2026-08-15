# Dedup Algorithm

`scripts/content-intelligence/dedup-checker.ts` compares a candidate against every
written + rejected topic in `state/topic-registry.json`.

## Similarity measures

- **Title similarity**: Jaccard similarity over word bigrams.
- **Keyword similarity**: normalized Levenshtein similarity.

The higher of the two is used. A candidate passes if similarity <= `dedupThreshold`
(default 0.70 in `config.json`).

## Usage

```bash
npx tsx scripts/content-intelligence/dedup-checker.ts "Candidate Title" "candidate keyword"
```

Exit code 0 = pass, 1 = rejected. Rejected candidates are logged in
`topic-registry.json` with `rejectionReason: "dedup"`.
