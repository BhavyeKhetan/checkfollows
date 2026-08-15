# BlogPost Data Template

Every generated post must match this shape in `src/lib/blog-posts.ts`.

```ts
{
  slug: "how-to-see-who-someone-recently-followed-on-instagram",
  title: "How to see who someone recently followed on Instagram",
  description: "Instagram hides the true follow order. Here is exactly how to see it. (120-160 chars)",
  date: "2026-08-20",
  readTime: "5 min read",
  category: "how-to",
  sections: [
    {
      paragraphs: [
        "Instagram does not sort the following list by date. The first paragraph answers the query directly and names Instagram immediately.",
      ],
    },
    {
      heading: "How Instagram really orders the list",
      paragraphs: ["...", "..."],
      bullets: ["..."],
    },
    // at least 3 sections with a heading (H2)
  ],
  faq: [
    { question: "Does Instagram show who you recently followed?", answer: "..." },
    { question: "Can you see unfollows natively?", answer: "..." },
  ],
  relatedSlugs: ["why-instagram-scrambles-following-list", "how-to-see-who-unfollowed-you"],
}
```

## Content requirements

- 800-2500 words body (sections, excluding FAQ)
- Answer-first opening paragraph (< 100 words)
- At least 3 H2 headings (sections with `heading`)
- 2-5 FAQ items with concrete answers
- 2-5 relatedSlugs from existing posts
- No AI-sounding phrases (see quality-gates.md)
- No em dashes
