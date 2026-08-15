import * as fs from "fs";
import * as path from "path";
import { BLOG_POSTS } from "../../src/lib/blog-posts";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SITE_URL = "https://checkfollows.com";

const CATEGORY_LABELS: Record<string, string> = {
  "how-to": "How-to",
  guides: "Guides",
  compare: "Compare",
  "buyers-guide": "Buyers Guide",
  platforms: "Platforms",
  privacy: "Privacy",
  scenarios: "Scenarios",
};

const CATEGORY_ORDER = ["how-to", "guides", "compare", "buyers-guide", "platforms", "privacy", "scenarios"];

function escapeMarkdown(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function buildLlmsText(): string {
  return `# CheckFollows

> See who any public Instagram account recently followed — anonymously, no login needed.

CheckFollows is an Instagram tracking tool that reveals the true chronological order of a following list, detects new follows and unfollows, and keeps a permanent history. The site publishes practical guides on Instagram following and follower tracking, privacy, and reading the signals hidden in who people follow.

## What CheckFollows Covers
- How to see who someone recently followed on Instagram
- How to see who unfollowed you
- Why Instagram scrambles the following and follower lists
- New follower and mutual follower explainers
- Password-free tracking methods and tool comparisons
- Instagram notification and ordering behavior

## Editorial Focus
- Answer-first, evidence-led articles
- Direct answers in the first sentence, named Instagram surfaces
- Practical steps and privacy caveats
- Internal links between related topics

## Links
- Website: ${SITE_URL}
- Blog: ${SITE_URL}/blog
- Pricing: ${SITE_URL}/pricing
- About: ${SITE_URL}/about
- Contact: ${SITE_URL}/contact
- Full content index: ${SITE_URL}/llms-full.txt
`;
}

function buildLlmsFullText(): string {
  const postsByCategory = new Map<string, typeof BLOG_POSTS>();
  for (const post of BLOG_POSTS) {
    const posts = postsByCategory.get(post.category) ?? [];
    posts.push(post);
    postsByCategory.set(post.category, posts);
  }

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((category) => postsByCategory.has(category)),
    ...Array.from(postsByCategory.keys()).filter((category) => !CATEGORY_ORDER.includes(category)).sort(),
  ];

  const lines: string[] = [
    "# CheckFollows — Full Content Index",
    "",
    "> Complete listing of all indexed CheckFollows articles for AI agents and search crawlers.",
    "",
    `Website: ${SITE_URL}`,
    `Total articles: ${BLOG_POSTS.length}`,
    "",
  ];

  for (const category of orderedCategories) {
    const posts = [...(postsByCategory.get(category) ?? [])].sort((a, b) => a.title.localeCompare(b.title));
    const label = CATEGORY_LABELS[category] ?? category;
    lines.push(`## ${label} (${posts.length} articles)`, "");
    for (const post of posts) {
      lines.push(`- [${escapeMarkdown(post.title)}](${SITE_URL}/blog/${post.slug})`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function main() {
  fs.writeFileSync(path.join(PUBLIC_DIR, "llms.txt"), buildLlmsText());
  fs.writeFileSync(path.join(PUBLIC_DIR, "llms-full.txt"), buildLlmsFullText());
  console.log(`Regenerated llms.txt and llms-full.txt for ${BLOG_POSTS.length} articles.`);
}

main();
