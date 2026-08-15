import * as fs from "fs";
import * as path from "path";
import { BLOG_POSTS } from "../../src/lib/blog-posts";

const ROOT = path.join(process.cwd(), "growth", "content-intelligence");

type IndexingGroup =
  | "indexed"
  | "crawled_not_indexed"
  | "discovered_not_indexed"
  | "unknown_to_google"
  | "blocked_or_error"
  | "other";

interface ScoredPost {
  slug: string;
  compositeScore: number;
  funnelScore: number;
  gscScore: number;
  engagementScore: number;
  maturity: "infant" | "mature";
  publishDate: string | null;
  ageDays: number;
  category: string;
  pageviews30d: number;
  impressions: number;
  indexCoverageState: string | null;
  indexVerdict: string | null;
  indexingGroup: IndexingGroup;
  lastCrawlTime: string | null;
}

interface CopyFeatures {
  wordCount: number;
  firstParagraphWords: number;
  directAnswerFirstSentence: boolean;
  titleQuestion: boolean;
  entityHits: number;
  evidenceHits: number;
  reassuranceFirstOpening: boolean;
}

const ENTITY_TERMS = [
  "instagram", "threads", "tiktok", "snapchat", "twitter", "x premium",
  "checkfollows", "following tracker", "follower tracker", "unfollow tracker",
  "story viewer", "follower analyzer", "following list", "follower list",
];

const EVIDENCE_TERMS = [
  "follow", "follower", "following", "unfollow", "list", "profile", "account",
  "username", "handle", "private", "public", "activity", "notification",
  "order", "chronological", "newest", "recent", "mutual", "request", "bio",
  "story", "post", "verified", "settings", "app", "tracker", "scan", "alert",
  "history", "timeline", "change", "login",
];

const REASSURANCE_FIRST_OPENINGS = [
  "you are not crazy",
  "you're not crazy",
  "you are not paranoid",
  "you're not paranoid",
  "you are not insecure",
  "you're not insecure",
  "you did not imagine",
  "you didn't imagine",
  "you are not overthinking",
  "you're not overthinking",
  "if you are reading this",
  "if you're reading this",
  "trust your gut",
  "your gut is",
];

function isValidBlogSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  let rank = 0;
  for (const v of sorted) {
    if (v < value) rank++;
    else break;
  }
  return (rank / sorted.length) * 100;
}

function findLatestFile(dir: string, prefix: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .filter((f) => prefix !== "gsc-" || !f.startsWith("gsc-indexing-"))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function getIndexingGroup(page: any): IndexingGroup {
  if (!page) return "other";
  const coverage = page.coverageState || "";
  if (page.error) return "blocked_or_error";
  if (coverage === "Submitted and indexed" || page.verdict === "PASS") return "indexed";
  if (coverage === "Crawled - currently not indexed") return "crawled_not_indexed";
  if (coverage === "Discovered - currently not indexed") return "discovered_not_indexed";
  if (coverage === "URL is unknown to Google") return "unknown_to_google";
  if (coverage.includes("Blocked") || coverage.includes("noindex") || page.robotsTxtState === "BLOCKED" || page.indexingState === "BLOCKED_BY_META_TAG") {
    return "blocked_or_error";
  }
  return "other";
}

function countTerms(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term)).length;
}

function postText(post: any): string {
  const parts: string[] = [];
  for (const section of post.sections || []) {
    if (section.heading) parts.push(section.heading);
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

function readCopyFeatures(post: any): CopyFeatures {
  const title = post.title || post.slug.replace(/-/g, " ");
  const textOnly = postText(post);
  const first = firstParagraph(post).toLowerCase();
  const directAnswerPattern =
    /^(yes|no|actually|[a-z0-9 ()',".-]{0,90}\b(usually|typically|often|shows up|show up|accepts|does not|doesn't|cannot|can't|can|means|is|are|solve|solves|requires|depends|hides|scrambles|sorts|never|always)\b)/i;

  return {
    wordCount: textOnly.split(/\s+/).filter(Boolean).length,
    firstParagraphWords: first.split(/\s+/).filter(Boolean).length,
    directAnswerFirstSentence: first ? directAnswerPattern.test(first) : false,
    titleQuestion: /\?/.test(title) || /^(does|do|can|how|what|where|why|is|are|should)\b/i.test(title),
    entityHits: countTerms(first, ENTITY_TERMS),
    evidenceHits: countTerms(first, EVIDENCE_TERMS),
    reassuranceFirstOpening: REASSURANCE_FIRST_OPENINGS.some((phrase) => first.startsWith(phrase)),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function summarizeCopyFeatures(posts: ScoredPost[], featureMap: Record<string, CopyFeatures>): Record<string, any> {
  const groups: IndexingGroup[] = ["indexed", "crawled_not_indexed", "discovered_not_indexed", "unknown_to_google", "blocked_or_error", "other"];
  const summary: Record<string, any> = {};
  for (const group of groups) {
    const features = posts.filter((p) => p.indexingGroup === group).map((p) => featureMap[p.slug]).filter(Boolean) as CopyFeatures[];
    if (features.length === 0) continue;
    summary[group] = {
      count: features.length,
      avgWordCount: average(features.map((f) => f.wordCount)),
      avgFirstParagraphWords: average(features.map((f) => f.firstParagraphWords)),
      directAnswerFirstSentenceRate: average(features.map((f) => (f.directAnswerFirstSentence ? 100 : 0))),
      titleQuestionRate: average(features.map((f) => (f.titleQuestion ? 100 : 0))),
      avgEntityHitsFirstParagraph: average(features.map((f) => f.entityHits)),
      avgEvidenceHitsFirstParagraph: average(features.map((f) => f.evidenceHits)),
      reassuranceFirstOpeningRate: average(features.map((f) => (f.reassuranceFirstOpening ? 100 : 0))),
    };
  }
  return summary;
}

function main() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
  const { compositeWeights, infantAgeDays, underperformerPercentile, minImpressionsForScoring } = config;

  const mixpanelFile = findLatestFile(path.join(ROOT, "raw"), "mixpanel-");
  const gscFile = findLatestFile(path.join(ROOT, "raw"), "gsc-");
  const indexingFile = findLatestFile(path.join(ROOT, "raw"), "gsc-indexing-");

  if (!mixpanelFile) {
    console.error("No Mixpanel data found in raw/");
    process.exit(1);
  }

  const mixpanelData = JSON.parse(fs.readFileSync(mixpanelFile, "utf8"));
  const gscData = gscFile ? JSON.parse(fs.readFileSync(gscFile, "utf8")) : { pages: {} };
  const indexingData = indexingFile ? JSON.parse(fs.readFileSync(indexingFile, "utf8")) : { pages: {}, coverageCounts: {} };

  const cumPerfPath = path.join(ROOT, "state", "cumulative-performance.json");
  const cumPerf = JSON.parse(fs.readFileSync(cumPerfPath, "utf8"));

  const publishDates: Record<string, string> = {};
  const categories: Record<string, string> = {};
  for (const post of BLOG_POSTS) {
    publishDates[post.slug] = post.date;
    categories[post.slug] = post.category;
  }

  const today = new Date();
  const allSlugs = new Set(
    [
      ...BLOG_POSTS.map((p) => p.slug),
      ...Object.keys(mixpanelData.slugs || {}),
      ...Object.keys(gscData.pages || {}),
      ...Object.keys(indexingData.pages || {}),
    ].filter(isValidBlogSlug),
  );

  const posts: ScoredPost[] = [];
  const conversionRates: number[] = [];
  const impressionsList: number[] = [];
  const ctrList: number[] = [];
  const pageviewsList: number[] = [];
  const durationList: number[] = [];

  for (const slug of allSlugs) {
    const mp = mixpanelData.slugs?.[slug];
    const gsc = gscData.pages?.[slug];
    if (mp) {
      conversionRates.push(mp.conversionRate);
      pageviewsList.push(mp.pageviews30d);
      durationList.push(mp.avgSessionDuration);
    }
    if (gsc) {
      impressionsList.push(gsc.impressions);
      ctrList.push(gsc.ctr);
    }
  }

  for (const slug of allSlugs) {
    const mp = mixpanelData.slugs?.[slug] || {
      pageviews7d: 0, pageviews30d: 0, uniqueVisitors30d: 0,
      avgSessionDuration: 0, funnelEntries: 0, funnelConversions: 0, conversionRate: 0,
    };
    const gsc = gscData.pages?.[slug];
    const indexing = indexingData.pages?.[slug];
    const indexingGroup = getIndexingGroup(indexing);

    const pubDate = publishDates[slug] || null;
    const ageDays = pubDate ? Math.floor((today.getTime() - new Date(pubDate).getTime()) / 86400000) : 999;
    const maturity: "infant" | "mature" = ageDays < infantAgeDays ? "infant" : "mature";

    const funnelScore = percentileRank(mp.conversionRate, conversionRates);
    const engagementScore =
      percentileRank(mp.pageviews30d, pageviewsList) * 0.5 +
      percentileRank(mp.avgSessionDuration, durationList) * 0.5;

    let gscScore = 0;
    let compositeScore: number;

    if (maturity === "infant" || !gsc) {
      compositeScore = funnelScore * 0.57 + engagementScore * 0.43;
    } else {
      gscScore = percentileRank(gsc.impressions, impressionsList) * 0.6 + percentileRank(gsc.ctr, ctrList) * 0.4;
      compositeScore =
        funnelScore * compositeWeights.funnel + gscScore * compositeWeights.gsc + engagementScore * compositeWeights.engagement;
    }

    posts.push({
      slug,
      compositeScore: Math.round(compositeScore * 10) / 10,
      funnelScore: Math.round(funnelScore * 10) / 10,
      gscScore: Math.round(gscScore * 10) / 10,
      engagementScore: Math.round(engagementScore * 10) / 10,
      maturity,
      publishDate: pubDate,
      ageDays,
      category: categories[slug] || "uncategorized",
      pageviews30d: mp.pageviews30d,
      impressions: gsc?.impressions || 0,
      indexCoverageState: indexing?.coverageState || null,
      indexVerdict: indexing?.verdict || null,
      indexingGroup,
      lastCrawlTime: indexing?.lastCrawlTime || null,
    });

    const postPerf = cumPerf.posts[slug] || {
      publishDate: pubDate,
      category: categories[slug] || "uncategorized",
      keyword: slug.replace(/-/g, " "),
      weeklyScores: [],
      currentComposite: 0,
      trend: "new",
      refreshCount: 0,
      lastRefreshed: null,
      generatedByLoop: false,
    };
    postPerf.indexCoverageState = indexing?.coverageState || postPerf.indexCoverageState || null;
    postPerf.indexVerdict = indexing?.verdict || postPerf.indexVerdict || null;
    postPerf.indexingGroup = indexingGroup;
    postPerf.lastCrawlTime = indexing?.lastCrawlTime || postPerf.lastCrawlTime || null;

    postPerf.weeklyScores = postPerf.weeklyScores.filter(
      (score: any, index: number, arr: any[]) => arr.findIndex((candidate: any) => candidate.week === score.week) === index,
    );

    const todayStr = today.toISOString().split("T")[0];
    const nextWeeklyScore = {
      week: todayStr,
      composite: Math.round(compositeScore * 10) / 10,
      funnel: Math.round(funnelScore * 10) / 10,
      gsc: Math.round(gscScore * 10) / 10,
      engagement: Math.round(engagementScore * 10) / 10,
    };

    const existingWeekIdx = postPerf.weeklyScores.findIndex((score: any) => score.week === todayStr);
    if (existingWeekIdx >= 0) postPerf.weeklyScores[existingWeekIdx] = nextWeeklyScore;
    else postPerf.weeklyScores.push(nextWeeklyScore);

    if (postPerf.weeklyScores.length > 1) {
      const prev = postPerf.weeklyScores[postPerf.weeklyScores.length - 2].composite;
      postPerf.trend = compositeScore > prev + 5 ? "rising" : compositeScore < prev - 5 ? "falling" : "stable";
    }
    postPerf.currentComposite = Math.round(compositeScore * 10) / 10;
    cumPerf.posts[slug] = postPerf;
  }

  posts.sort((a, b) => a.compositeScore - b.compositeScore);

  const copyFeaturesBySlug: Record<string, CopyFeatures> = {};
  for (const post of BLOG_POSTS) {
    copyFeaturesBySlug[post.slug] = readCopyFeatures(post);
  }
  const indexCopyPatternSummary = summarizeCopyFeatures(posts, copyFeaturesBySlug);

  const maturePosts = posts.filter(
    (p) => p.maturity === "mature" && (p.impressions >= minImpressionsForScoring || p.indexingGroup === "crawled_not_indexed"),
  );
  const cutoff = Math.min(maturePosts.length, Math.max(config.weeklyTargets.refreshes, Math.ceil(maturePosts.length * (underperformerPercentile / 100))));
  const refreshCandidates = maturePosts.slice(0, cutoff);

  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString().split("T")[0];
  const underperformers = refreshCandidates
    .filter((p) => {
      const perf = cumPerf.posts[p.slug];
      return !perf?.lastRefreshed || perf.lastRefreshed < fourWeeksAgo;
    })
    .slice(0, config.weeklyTargets.refreshes)
    .map((p) => p.slug);

  const topPerformers = [...posts].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 10).map((p) => p.slug);

  const indexCoverageSummary: Record<string, number> = {};
  const indexCoverageByCategory: Record<string, Record<string, number>> = {};
  for (const p of posts) {
    indexCoverageSummary[p.indexingGroup] = (indexCoverageSummary[p.indexingGroup] || 0) + 1;
    if (!indexCoverageByCategory[p.category]) indexCoverageByCategory[p.category] = {};
    indexCoverageByCategory[p.category][p.indexingGroup] = (indexCoverageByCategory[p.category][p.indexingGroup] || 0) + 1;
  }

  const indexedPosts = posts.filter((p) => p.indexingGroup === "indexed");
  const indexedCategoryScores: Record<string, number> = {};
  for (const p of indexedPosts) indexedCategoryScores[p.category] = (indexedCategoryScores[p.category] || 0) + 1;
  const topIndexedCategories = Object.entries(indexedCategoryScores).sort(([, a], [, b]) => b - a).slice(0, 3).map(([cat]) => cat);

  const categoryScores: Record<string, number[]> = {};
  for (const p of posts.filter((p) => p.maturity === "mature")) {
    if (!categoryScores[p.category]) categoryScores[p.category] = [];
    categoryScores[p.category].push(p.compositeScore);
  }
  const avgScoreByCategory: Record<string, number> = {};
  for (const [cat, scores] of Object.entries(categoryScores)) {
    avgScoreByCategory[cat] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  const todayStr = today.toISOString().split("T")[0];
  const analysis = {
    date: todayStr,
    totalPostsScored: posts.length,
    infantPosts: posts.filter((p) => p.maturity === "infant").length,
    avgScoreByCategory,
    topPerformers,
    underperformers,
    indexCoverageSource: indexingFile,
    indexCoverageSummary,
    indexCoverageByCategory,
    indexCopyPatternSummary,
    indexedPosts: indexedPosts.map((p) => p.slug),
    scores: posts.sort((a, b) => b.compositeScore - a.compositeScore),
  };

  const analysisPath = path.join(ROOT, "analysis", `${todayStr}.json`);
  fs.mkdirSync(path.dirname(analysisPath), { recursive: true });
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`Analysis written to ${analysisPath}`);

  cumPerf.lastUpdated = todayStr;
  fs.writeFileSync(cumPerfPath, JSON.stringify(cumPerf, null, 2));
  console.log(`Cumulative performance updated (${Object.keys(cumPerf.posts).length} posts)`);

  const insightsPath = path.join(ROOT, "state", "learning-insights.json");
  const insights = JSON.parse(fs.readFileSync(insightsPath, "utf8"));
  const topCats = Object.entries(avgScoreByCategory).sort(([, a], [, b]) => b - a).slice(0, 3).map(([cat]) => cat);

  const nextInsight = {
    week: todayStr,
    topPerformingCategories: topCats,
    topIndexedCategories,
    avgScoreByCategory,
    indexCoverageSummary,
    indexCoverageByCategory,
    indexCopyPatternSummary,
    recommendations: [
      ...topCats.map((c) => `Prioritize '${c}' category (avg score: ${avgScoreByCategory[c]})`),
      "Before selecting topics, compare indexed vs not-indexed copy features and reject reassurance-first openings.",
      "For factual/platform pages, require direct-answer first sentence plus Instagram surface and evidence terms in the opening paragraph.",
    ],
  };
  insights.weeklyInsights = (insights.weeklyInsights || []).filter(
    (entry: any, index: number, arr: any[]) => arr.findIndex((candidate: any) => candidate.week === entry.week) === index,
  );
  const existingInsightIdx = (insights.weeklyInsights || []).findIndex((entry: any) => entry.week === todayStr);
  if (existingInsightIdx >= 0) insights.weeklyInsights[existingInsightIdx] = nextInsight;
  else insights.weeklyInsights.push(nextInsight);
  insights.lastUpdated = todayStr;
  fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2));
  console.log("Learning insights updated");
}

main();
