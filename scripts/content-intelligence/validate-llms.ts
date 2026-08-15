import * as fs from "fs";
import * as path from "path";
import { BLOG_POSTS } from "../../src/lib/blog-posts";

const LLMS_PATH = path.join(process.cwd(), "public", "llms.txt");
const LLMS_FULL_PATH = path.join(process.cwd(), "public", "llms-full.txt");
const SITE_URL = "https://checkfollows.com";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(LLMS_PATH)) fail("public/llms.txt is missing");
  if (!fs.existsSync(LLMS_FULL_PATH)) fail("public/llms-full.txt is missing");

  const llms = fs.readFileSync(LLMS_PATH, "utf8");
  const full = fs.readFileSync(LLMS_FULL_PATH, "utf8");

  if (!llms.includes(`${SITE_URL}/llms-full.txt`)) fail("public/llms.txt does not link to llms-full.txt");

  const forbiddenPattern = /\b(undefined|null|NaN)\b/i;
  if (forbiddenPattern.test(llms)) fail("public/llms.txt contains undefined/null/NaN");
  if (forbiddenPattern.test(full)) fail("public/llms-full.txt contains undefined/null/NaN");

  const totalMatch = full.match(/^Total articles:\s*(\d+)$/m);
  if (!totalMatch) fail("public/llms-full.txt is missing Total articles");
  const total = Number(totalMatch[1]);
  if (total !== BLOG_POSTS.length) fail(`public/llms-full.txt total ${total} does not match registry ${BLOG_POSTS.length}`);

  const seen = new Set<string>();
  for (const post of BLOG_POSTS) {
    if (!post.slug || !post.title) fail(`Invalid blog registry entry: ${JSON.stringify(post)}`);
    if (seen.has(post.slug)) fail(`Duplicate blog slug in registry: ${post.slug}`);
    seen.add(post.slug);
    const url = `${SITE_URL}/blog/${post.slug}`;
    if (!full.includes(`](${url})`)) fail(`public/llms-full.txt missing ${url}`);
  }

  const linkedSlugs = Array.from(full.matchAll(/https:\/\/checkfollows\.com\/blog\/([a-z0-9-]+)/g)).map((m) => m[1]);
  for (const slug of linkedSlugs) {
    if (!seen.has(slug)) fail(`public/llms-full.txt links to slug outside registry: ${slug}`);
  }

  console.log(`PASS: llms indexes cover ${BLOG_POSTS.length} registry entries.`);
}

main();
