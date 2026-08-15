import * as fs from "fs";
import * as path from "path";
import { BLOG_POSTS } from "../../src/lib/blog-posts";
import { checkDedup } from "./dedup-checker";

const BLOG_PAGE_PATH = path.join(process.cwd(), "src", "app", "blog", "[slug]", "page.tsx");
const ROBOTS_PATH = path.join(process.cwd(), "src", "app", "robots.ts");

const VALID_CATEGORIES = ["how-to", "guides", "compare", "buyers-guide", "platforms", "privacy", "scenarios"];

const BANNED_PHRASES = [
  "delve", "landscape", "tapestry", "testament", "vibrant", "crucial", "pivotal",
  "in today's", "let's dive", "nestled", "navigating", "elevate", "embark",
  "foster", "leverage", "paramount", "realm", "unleash", "beacon", "cornerstone",
];

const REASSURANCE_FIRST_OPENINGS = [
  "you are not crazy", "you're not crazy", "you are not paranoid", "you're not paranoid",
  "you are not insecure", "you're not insecure", "you did not imagine", "you didn't imagine",
  "you are not overthinking", "you're not overthinking", "if you are reading this",
  "if you're reading this", "trust your gut", "your gut is",
];

const ENTITY_TERMS = [
  "instagram", "threads", "tiktok", "snapchat", "twitter", "x premium", "checkfollows",
  "following list", "follower list", "following tracker", "follower tracker",
  "unfollow tracker", "story viewer", "follower analyzer",
];

const EVIDENCE_TERMS = [
  "follow", "follower", "following", "unfollow", "list", "profile", "account",
  "username", "handle", "private", "public", "activity", "notification", "order",
  "chronological", "newest", "recent", "mutual", "request", "bio", "story", "post",
  "verified", "settings", "app", "tracker", "scan", "alert", "history", "timeline",
];

function countTerms(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term)).length;
}

function postBodyText(post: any): string {
  const parts: string[] = [];
  for (const section of post.sections || []) {
    if (section.paragraphs) parts.push(...section.paragraphs);
    if (section.bullets) parts.push(...section.bullets);
  }
  return parts.join(" ");
}

function firstParagraph(post: any): string {
  for (const section of post.sections || []) {
    if (section.paragraphs && section.paragraphs.length > 0) return section.paragraphs[0];
  }
  return "";
}

function h2Count(post: any): number {
  return (post.sections || []).filter((s: any) => s.heading).length;
}

interface ValidationResult {
  slug: string;
  passed: boolean;
  failures: string[];
}

function validatePost(slug: string): ValidationResult {
  const failures: string[] = [];
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) return { slug, passed: false, failures: ["No BLOG_POSTS entry found"] };

  // Gate 2: Metadata completeness.
  if (!post.title || post.title.length > 60) failures.push(`Gate 2 (Metadata): title missing or > 60 chars ("${post.title}")`);
  if (!post.description || post.description.length < 120 || post.description.length > 160) {
    failures.push(`Gate 2 (Metadata): description must be 120-160 chars (got ${post.description?.length || 0})`);
  }
  if (!post.date || !/^\d{4}-\d{2}-\d{2}$/.test(post.date)) failures.push("Gate 2 (Metadata): invalid or missing ISO date");
  if (fs.existsSync(BLOG_PAGE_PATH)) {
    const page = fs.readFileSync(BLOG_PAGE_PATH, "utf8");
    if (!page.includes("canonical")) failures.push("Gate 2 (Metadata): blog page missing canonical");
    if (!page.includes("openGraph")) failures.push("Gate 2 (Metadata): blog page missing openGraph");
    if (!page.includes("publishedTime")) failures.push("Gate 2 (Metadata): blog page missing publishedTime");
  }

  // Gate 3: BlogPost props.
  if (!VALID_CATEGORIES.includes(post.category)) failures.push(`Gate 3 (Props): invalid category "${post.category}"`);
  if (!/^\d+ min read$/.test(post.readTime || "")) failures.push("Gate 3 (Props): invalid or missing readTime");
  const faq = Array.isArray(post.faq) ? post.faq : [];
  if (faq.length < 2) failures.push(`Gate 3 (Props): only ${faq.length} FAQ items (minimum 2)`);

  // Gate 4: Internal links.
  const related = Array.isArray(post.relatedSlugs) ? post.relatedSlugs : [];
  if (related.length < 2) failures.push(`Gate 4 (Links): only ${related.length} relatedSlugs (minimum 2)`);
  for (const relatedSlug of related) {
    if (!BLOG_POSTS.some((p) => p.slug === relatedSlug)) failures.push(`Gate 4 (Links): relatedSlug "${relatedSlug}" does not exist`);
  }

  // Gate 5: Dedup.
  const dedup = checkDedup(post.title, slug.replace(/-/g, " "));
  if (!dedup.pass) failures.push(`Gate 5 (Dedup): similarity ${dedup.similarity} vs "${dedup.closestMatch}"`);

  // Gate 6: Content quality.
  const textOnly = postBodyText(post);
  const wordCount = textOnly.split(/\s+/).filter(Boolean).length;
  if (wordCount < 800) failures.push(`Gate 6 (Quality): only ${wordCount} words (minimum 800)`);
  if (wordCount > 2500) failures.push(`Gate 6 (Quality): ${wordCount} words (maximum 2500)`);

  const lower = textOnly.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) failures.push(`Gate 6 (Quality): banned phrase "${phrase}"`);
  }
  if (textOnly.includes("\u2014")) failures.push("Gate 6 (Quality): em dash present (use regular dash)");
  if (h2Count(post) < 3) failures.push(`Gate 6 (Quality): only ${h2Count(post)} H2 headings (minimum 3)`);
  const first = firstParagraph(post);
  const firstWords = first.split(/\s+/).filter(Boolean).length;
  if (firstWords > 100) failures.push(`Gate 6 (Quality): first paragraph is ${firstWords} words (max 100)`);

  // Gate 9: Indexability.
  if (fs.existsSync(ROBOTS_PATH)) {
    const robots = fs.readFileSync(ROBOTS_PATH, "utf8");
    if (/index\s*:\s*false/i.test(robots) || /noindex/i.test(robots)) failures.push("Gate 9 (Indexability): robots.ts blocks indexing");
  }

  // Gate 10: Indexing copy fit.
  const firstLower = first.toLowerCase();
  const titleOrSlug = `${post.title} ${post.slug}`.toLowerCase();
  const hasIndexingIntent = countTerms(titleOrSlug, ENTITY_TERMS) > 0 || countTerms(titleOrSlug, EVIDENCE_TERMS) > 0;
  if (hasIndexingIntent) {
    if (!first) failures.push("Gate 10 (Indexing copy fit): missing opening paragraph");
    const banned = REASSURANCE_FIRST_OPENINGS.find((p) => firstLower.startsWith(p));
    if (banned) failures.push(`Gate 10 (Indexing copy fit): reassurance-first opening "${banned}"`);
    const directAnswerPattern =
      /^(yes|no|actually|[a-z0-9 ()',".-]{0,90}\b(usually|typically|often|shows up|show up|accepts|does not|doesn't|cannot|can't|can|means|is|are|solve|solves|requires|depends|hides|scrambles|sorts|never|always)\b)/i;
    if (first && !directAnswerPattern.test(first)) failures.push("Gate 10 (Indexing copy fit): first sentence does not answer directly");
    const entityHits = countTerms(first, ENTITY_TERMS);
    if (entityHits < 1) failures.push("Gate 10 (Indexing copy fit): first paragraph names no specific entity");
    const evidenceHits = countTerms(first, EVIDENCE_TERMS);
    if (evidenceHits < 2) failures.push(`Gate 10 (Indexing copy fit): only ${evidenceHits} evidence terms (min 2)`);
  }

  return { slug, passed: failures.length === 0, failures };
}

function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error("Usage: npx tsx validate-posts.ts slug1 slug2 ...");
    process.exit(1);
  }

  let allPassed = true;
  for (const slug of slugs) {
    const result = validatePost(slug);
    if (result.passed) {
      console.log(`PASS: ${slug}`);
    } else {
      console.log(`FAIL: ${slug}`);
      for (const f of result.failures) console.log(`  - ${f}`);
      allPassed = false;
    }
  }
  process.exit(allPassed ? 0 : 1);
}

main();
