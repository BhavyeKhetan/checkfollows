---
name: content-machine-page-generation
description: Use for CheckFollows blog and SEO page production. This skill governs article voice, page structure, and quality gates for content execution in this repo.
---

# Content Machine Page Generation

Use this skill for blog post creation and major article rewrites.

## Blog storage

Posts are data objects in `src/lib/blog-posts.ts` (the `BLOG_POSTS` array), rendered by
`src/app/blog/[slug]/page.tsx`. Each post uses this shape:

```ts
{
  slug: string;          // kebab-case
  title: string;
  description: string;   // 120-160 chars
  date: string;          // YYYY-MM-DD
  readTime: string;      // "N min read"
  category: string;      // how-to | guides | compare | buyers-guide | platforms | privacy | scenarios
  sections: { heading?: string; paragraphs?: string[]; bullets?: string[] }[];
  faq?: { question: string; answer: string }[];     // >= 2
  relatedSlugs?: string[];                           // 2-5 existing slugs
}
```

## Voice

- Write like a smart, blunt friend who understands why someone is checking an
  Instagram following list.
- Aim around a 10th-grade reading level.
- Talk to the reader directly with `you` and `your`.
- Use contractions.
- Avoid em dashes.
- Do not drift into therapy jargon, corporate copy, or generic SEO filler.

## Reader context

The core reader wants to know who someone recently followed or unfollowed on
Instagram. They are curious, sometimes anxious, and want a concrete answer fast.
Write to that state, not to a generic "user."

## Hard style bans

- No em dashes.
- No vague authority phrases like "experts say" without naming the source.
- No inflated phrases like "in today's digital age" or "let's dive in."
- No filler conclusions like "trust your instincts" unless you add a concrete step.
- No bullet-list spam when a paragraph would read better.

## Opening paragraph standard

The first paragraph must:

1. answer the search query in the first sentence or two
2. name Instagram (or the specific surface) immediately
3. include a concrete detail (a specific in-app path, a behavior, or a named tool)
4. stay tight enough to work as a search or AI snippet

Emotional context is allowed only after the factual answer is established.

## Drafting checklist

- Does the post answer the query fast?
- Does it stay in the repo's voice?
- Does it avoid banned AI phrases and rhythm?
- Does it offer specific next actions (not vague advice)?
- Does it fit the BlogPost data shape above, including 2+ FAQ items and 2-5 relatedSlugs?
