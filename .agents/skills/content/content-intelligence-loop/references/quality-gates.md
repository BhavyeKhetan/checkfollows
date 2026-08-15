# Quality Gates

All 10 gates must pass before commit. No human review — these are the safety net.

Run via: `npx tsx scripts/content-intelligence/validate-posts.ts slug1 slug2 ...`

## Gate 1: TypeScript compilation
Covered by the automation policy's `required_checks` (`npm run build`). The registry
must typecheck against the `BlogPost` type in `src/lib/blog-posts.ts`.

## Gate 2: Metadata completeness
- `title` non-empty, under 60 characters
- `description` 120-160 characters
- `date` valid ISO date
- Blog page (`src/app/blog/[slug]/page.tsx`) exposes `canonical`, `openGraph`, and `publishedTime`

## Gate 3: BlogPost props
- `category` one of: `how-to`, `guides`, `compare`, `buyers-guide`, `platforms`, `privacy`, `scenarios`
- `readTime` format `N min read`
- `faq` array with >= 2 items, each with non-empty `question` and `answer`
- `relatedSlugs` 2-5 entries

## Gate 4: Internal link validation
Every slug in `relatedSlugs` must exist in `BLOG_POSTS`.

## Gate 5: Dedup
Run `dedup-checker.ts` for every new title + keyword. Reject if similarity > 0.70.

## Gate 6: Content quality
- 800-2500 words body content (sections, excluding FAQ)
- No banned AI phrases: "delve", "landscape", "tapestry", "testament", "vibrant",
  "crucial", "pivotal", "in today's", "let's dive", "nestled", "navigating",
  "elevate", "embark", "foster", "leverage", "paramount", "realm", "unleash",
  "beacon", "cornerstone"
- No em dashes
- First paragraph under 100 words
- At least 3 H2 headings (sections with `heading`)

## Gate 7: Registry consistency
No duplicate slugs in `BLOG_POSTS`.

## Gate 8: Build smoke test
`npm run build` must pass (runs typecheck + static generation). After build, regenerate
and validate the llms indexes:
- `npx tsx scripts/content-intelligence/regenerate-llms.ts`
- `npx tsx scripts/content-intelligence/validate-llms.ts`

The `llms.txt` / `llms-full.txt` files must be generated from `BLOG_POSTS`, not hand-edited.

## Gate 9: Indexability
- `/blog/<slug>` must not be blocked by `src/app/robots.ts`
- No `index: false` or `noindex` directives

## Gate 10: Indexing copy fit
The post must pass:
- First sentence answers the query directly, not after an emotional setup
- First paragraph names Instagram or the specific surface
- First paragraph includes at least two concrete evidence terms
- Opening does not start with reassurance-first phrases ("you are not crazy",
  "you're not paranoid", "trust your gut", "if you are reading this")
- Emotional context appears only after the factual answer is established

## On failure

Fix the issue, re-run validation, and only commit after all gates pass. If a post
cannot be fixed after 2 attempts, drop it and log the failure.
