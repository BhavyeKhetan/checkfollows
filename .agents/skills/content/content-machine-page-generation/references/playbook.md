# Content Machine Playbook

Working reference for long-form content generation in CheckFollows.

## Voice

- Write like a smart, blunt friend who understands why someone is checking an
  Instagram following list.
- Aim around a 10th-grade reading level.
- Talk to the reader directly with `you` and `your`.
- Use contractions. Avoid em dashes.
- Do not drift into therapist jargon, corporate copy, or generic SEO filler.

## Reader context

The core reader wants to know who someone recently followed or unfollowed on
Instagram. They want a concrete answer fast, not reassurance. Write to that state.

## Hard style bans

- No em dashes.
- No vague authority phrases like "experts say" without naming the source.
- No inflated phrases like "in today's digital age" or "let's dive in."
- No filler conclusions like "trust your instincts" unless you add a concrete step.
- No bullet-list spam when a paragraph would read better.

## Page architecture

Posts live as data objects in `src/lib/blog-posts.ts`. Each post should include:

- keyword-aware title
- strong meta description (120-160 chars)
- direct opening answer naming Instagram or the specific surface
- clear H2 structure (sections with `heading`)
- 2-5 FAQ items
- 2-5 related internal links

## Opening paragraph standard

1. answer the search query in the first sentence or two
2. name Instagram or the specific surface immediately
3. include a concrete detail or named tool
4. stay tight enough to work as a search or AI snippet

## Drafting checklist

- Does the post answer the query fast?
- Does it stay in the repo's voice?
- Does it avoid banned AI phrases and rhythm?
- Does it offer specific next actions?
- Does it fit the BlogPost data shape (faq, relatedSlugs, sections)?
