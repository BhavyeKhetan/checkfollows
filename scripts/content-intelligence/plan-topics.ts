import * as fs from "fs";
import * as path from "path";
import { checkDedup } from "./dedup-checker";

const ROOT = path.join(process.cwd(), "growth", "content-intelligence");
const MAX_NEW_TOPICS = Number(process.env.CONTENT_INTELLIGENCE_MAX_NEW_TOPICS || 12);
const MAX_REFRESHES = Number(process.env.CONTENT_INTELLIGENCE_MAX_REFRESHES || 3);

const ENTITY_TERMS = [
  "instagram", "threads", "tiktok", "snapchat", "twitter", "x premium",
  "following list", "follower list", "following tracker", "follower tracker",
  "unfollow tracker", "story viewer", "checkfollows",
];

const EVIDENCE_TERMS = [
  "follow", "follower", "following", "unfollow", "list", "profile", "account",
  "username", "handle", "private", "public", "activity", "notification",
  "order", "chronological", "newest", "recent", "mutual", "request", "bio",
  "story", "post", "verified", "settings", "app", "tracker", "scan", "alert",
];

const BANNED_QUERY_TERMS = [
  "checkfollows.com",
  "login",
  "password",
  "hack",
  "crack",
  "onlyfans",
  "porn",
];

interface TopicRegistryEntry {
  slug: string;
  title: string;
  keyword?: string;
  category?: string;
  addedWeek?: string;
}

interface CandidateTopic {
  rank: number;
  title: string;
  keyword: string;
  category: string;
  slug: string;
  gapReason: string;
  suggestedFormat: string;
  relatedSlugs: string[];
  sourceSlug: string;
  opportunityScore: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateArg(): string {
  const index = process.argv.indexOf("--date");
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : process.env.AUTOMATION_REPORT_DATE || today();
}

function readJson(relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function latestFile(directory: string, prefix: string): string | null {
  const absoluteDirectory = path.join(ROOT, directory);
  if (!fs.existsSync(absoluteDirectory)) return null;
  const files = fs
    .readdirSync(absoluteDirectory)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .filter((file) => prefix !== "gsc-" || !file.startsWith("gsc-indexing-"))
    .sort();
  return files.length ? path.join(directory, files[files.length - 1]) : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleCase(value: string): string {
  const small = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "vs", "with"]);
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (lower === "instagram") return "Instagram";
      if (lower === "threads") return "Threads";
      if (lower === "tiktok") return "TikTok";
      if (lower === "snapchat") return "Snapchat";
      if (lower === "twitter") return "Twitter";
      if (lower === "checkfollows") return "CheckFollows";
      if (index > 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/[?!.]+$/g, "").replace(/\s+/g, " ").trim();
}

function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function isFactualQuery(query: string): boolean {
  return /^(does|do|can|how|what|where|why|is|are|which|should)\b/.test(query);
}

function isValidCandidateQuery(query: string): boolean {
  if (!query || query.length < 12 || query.length > 90) return false;
  if (BANNED_QUERY_TERMS.some((term) => query.includes(term))) return false;
  if (!hasAny(query, ENTITY_TERMS)) return false;
  if (!isFactualQuery(query) && !hasAny(query, EVIDENCE_TERMS)) return false;
  return true;
}

function categoryFor(query: string): string {
  if (query.includes(" vs ") || query.includes("alternative")) return "compare";
  if (query.includes("tracker") || query.includes("app")) return "buyers-guide";
  if (query.startsWith("how ")) return "how-to";
  if (query.includes("notify") || query.includes("order") || query.includes("algorithm") || query.includes("show")) return "platforms";
  return "how-to";
}

function suggestedFormatFor(query: string): string {
  if (query.includes("order") || query.includes("chronological")) {
    return "Answer-first explainer of Instagram's following/follower list ordering with the exact in-app path and what changes are hidden.";
  }
  if (query.includes("unfollow")) {
    return "Answer-first unfollow detection guide with named surface, notification behavior, and a safe password-free method.";
  }
  if (query.includes("recent") || query.includes("newest")) {
    return "Answer-first guide to seeing recent follows/followers with concrete in-app steps and a named tool.";
  }
  return "Answer-first factual lookup guide with a named Instagram surface and concrete verification steps.";
}

function chooseRelatedSlugs(
  sourceSlug: string,
  query: string,
  registry: TopicRegistryEntry[],
  topPerformers: string[],
): string[] {
  const related = new Set<string>();
  const writtenSlugs = new Set(registry.map((e) => e.slug));
  if (sourceSlug && writtenSlugs.has(sourceSlug)) related.add(sourceSlug);

  for (const entry of registry) {
    if (related.size >= 5) break;
    if (entry.slug === sourceSlug) continue;
    const haystack = `${entry.slug} ${entry.title} ${entry.keyword || ""}`.toLowerCase();
    if (hasAny(query, ENTITY_TERMS.filter((term) => haystack.includes(term)))) related.add(entry.slug);
  }

  for (const slug of topPerformers) {
    if (related.size >= 5) break;
    if (slug !== sourceSlug && writtenSlugs.has(slug)) related.add(slug);
  }

  for (const entry of registry) {
    if (related.size >= 5) break;
    if (entry.category === "how-to" || entry.category === "platforms") related.add(entry.slug);
  }

  return Array.from(related).slice(0, 5);
}

function currentScoreFor(analysis: any, slug: string): number | null {
  const score = (analysis.scores || []).find((entry: any) => entry.slug === slug);
  return score?.compositeScore ?? null;
}

function refreshReasonFor(analysis: any, slug: string): string {
  const score = (analysis.scores || []).find((entry: any) => entry.slug === slug);
  if (score?.indexingGroup === "crawled_not_indexed") return "Crawled currently not indexed; refresh toward a more factual, named-surface answer shape.";
  if (score?.gscScore < score?.engagementScore) return "Low GSC score; refresh title, description, first answer, and query fit.";
  if (score?.engagementScore < score?.gscScore) return "Low engagement score; improve structure, evidence density, and next actions.";
  return "Low composite score among mature posts; refresh to match current indexing-copy rules.";
}

function readTopicPool(): { keyword: string; category: string }[] {
  const poolPath = path.join(ROOT, "topic-pool.json");
  if (!fs.existsSync(poolPath)) return [];
  return readJson("topic-pool.json").topics || [];
}

function main() {
  const reportDate = parseDateArg();
  const registry = readJson("state/topic-registry.json") as { written: TopicRegistryEntry[]; rejected: TopicRegistryEntry[] };
  const config = readJson("config.json");
  const gscPath = latestFile("raw", "gsc-");
  const indexingPath = latestFile("raw", "gsc-indexing-");
  const analysisPath = latestFile("analysis", "20");

  if (!gscPath) throw new Error("No GSC raw data found. Run collect before planning topics.");
  if (!analysisPath) throw new Error("No analysis file found. Run score before planning topics.");

  const gsc = readJson(gscPath);
  const indexing = indexingPath ? readJson(indexingPath) : { coverageCounts: {} };
  const analysis = readJson(analysisPath);
  const topPerformers = (analysis.topPerformers || []).slice(0, 10);
  const candidates: CandidateTopic[] = [];
  const seenSlugs = new Set(registry.written.map((entry) => entry.slug));
  const seenCandidateSlugs = new Set<string>();
  const rejectedTopics: any[] = [];

  function addCandidate(keywordRaw: string, sourceSlug: string, opportunityScore: number, gapReason: string) {
    const keyword = normalizeQuery(keywordRaw);
    if (!isValidCandidateQuery(keyword)) return;

    const title = `${titleCase(keyword)}?`;
    const slug = slugify(keyword);
    if (!slug || seenSlugs.has(slug) || seenCandidateSlugs.has(slug)) return;

    const dedup = checkDedup(title, keyword, config.dedupThreshold);
    if (!dedup.pass) {
      rejectedTopics.push({ title, keyword, rejectionReason: "dedup", similarity: dedup.similarity, closestMatch: dedup.closestMatch });
      return;
    }

    const relatedSlugs = chooseRelatedSlugs(sourceSlug, keyword, registry.written, topPerformers);
    if (relatedSlugs.length < 2) {
      rejectedTopics.push({ title, keyword, rejectionReason: "insufficient-related-slugs" });
      return;
    }

    seenCandidateSlugs.add(slug);
    candidates.push({
      rank: 0,
      title,
      keyword,
      category: categoryFor(keyword),
      slug,
      gapReason,
      suggestedFormat: suggestedFormatFor(keyword),
      relatedSlugs,
      sourceSlug,
      opportunityScore,
    });
  }

  // 1. Mine live GSC queries.
  for (const [sourceSlug, page] of Object.entries<any>(gsc.pages || {})) {
    const queries = Array.isArray(page.topQueries) ? page.topQueries : [];
    for (const rawQuery of queries) {
      addCandidate(
        String(rawQuery),
        sourceSlug,
        Number(page.impressions || 0) * Math.max(0.01, 1 - Number(page.ctr || 0)),
        `Live GSC query from ${sourceSlug}: "${String(rawQuery)}". Candidate preserves named-surface factual intent and concrete evidence terms.`,
      );
    }
  }

  // 2. Fall back to the seed topic pool when GSC has no usable queries yet.
  if (candidates.length === 0) {
    for (const poolTopic of readTopicPool()) {
      addCandidate(poolTopic.keyword, "", 0, `Seed topic pool (pre-GSC): "${poolTopic.keyword}".`);
    }
  }

  const newTopics = candidates
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, Math.max(0, Math.min(MAX_NEW_TOPICS, config.weeklyTargets?.newPosts || 12)))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const underperformerSlugs = Array.isArray(analysis.underperformers) ? analysis.underperformers : [];
  const refreshTargets = underperformerSlugs
    .slice(0, Math.max(0, Math.min(MAX_REFRESHES, config.weeklyTargets?.refreshes || 3)))
    .map((slug: string) => ({
      slug,
      currentScore: currentScoreFor(analysis, slug),
      refreshReason: refreshReasonFor(analysis, slug),
      suggestedChanges: [
        "Keep the existing slug and publish date.",
        "Open with a direct factual answer before emotional context.",
        "Increase named-surface and concrete evidence terms in the first paragraph.",
      ],
    }));

  const output = {
    date: reportDate,
    blocked: newTopics.length === 0 && refreshTargets.length === 0,
    sourceEvidence: {
      gscPath,
      gscPeriod: gsc.period || null,
      analysisPath,
      indexingPath,
      indexCoverageSummary: analysis.indexCoverageSummary || indexing.coverageCounts || {},
      decision:
        newTopics.length > 0 || refreshTargets.length > 0
          ? "Selected deterministic topics (GSC-derived or seed pool) and mature refresh targets before OpenClaw drafting."
          : "Blocked: no deterministic topics or refresh targets survived hard filters.",
    },
    newTopics,
    rejectedTopics: rejectedTopics.slice(0, 25),
    refreshTargets,
  };

  const outPath = path.join(ROOT, "analysis", `topics-${reportDate}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), outPath)} with ${newTopics.length} new topic(s) and ${refreshTargets.length} refresh target(s).`);

  if (output.blocked) {
    console.error(output.sourceEvidence.decision);
    process.exit(1);
  }
}

main();
