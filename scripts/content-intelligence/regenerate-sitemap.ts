import * as fs from "fs";
import * as path from "path";
import { BLOG_POSTS } from "../../src/lib/blog-posts";

const SITEMAP_PATH = path.join(process.cwd(), "src", "app", "sitemap.ts");
const BLOG_PAGE_PATH = path.join(process.cwd(), "src", "app", "blog", "[slug]", "page.tsx");

function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error("Usage: npx tsx regenerate-sitemap.ts slug1 slug2 ...");
    process.exit(1);
  }

  // CheckFollows generates /sitemap.xml dynamically from BLOG_POSTS via
  // src/app/sitemap.ts, and static blog params via generateStaticParams.
  // Both read BLOG_POSTS, so a registry entry guarantees sitemap inclusion
  // after the next build (run by the automation policy's required_checks).
  const known = new Set(BLOG_POSTS.map((p) => p.slug));
  const missing: string[] = [];
  for (const slug of slugs) {
    if (!known.has(slug)) missing.push(slug);
  }

  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error(`Sitemap source missing at ${SITEMAP_PATH}`);
    process.exit(1);
  }
  const sitemap = fs.readFileSync(SITEMAP_PATH, "utf8");
  if (!sitemap.includes("BLOG_POSTS")) {
    console.error("src/app/sitemap.ts does not reference BLOG_POSTS; new slugs would not be included.");
    process.exit(1);
  }
  if (!fs.existsSync(BLOG_PAGE_PATH)) {
    console.error(`Blog page missing at ${BLOG_PAGE_PATH}`);
    process.exit(1);
  }

  if (missing.length > 0) {
    console.error(`Registry missing ${missing.length} slug(s):`);
    for (const s of missing) console.error(`  - ${s}`);
    process.exit(1);
  }

  console.log(`Sitemap verified: all ${slugs.length} slugs present in BLOG_POSTS and wired into the dynamic sitemap.`);
}

main();
