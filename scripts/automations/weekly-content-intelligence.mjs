import fs from "node:fs";
import path from "node:path";
import { run } from "./lib/policy.mjs";
import { callOpenClawComplete } from "./lib/openclaw-client.mjs";

const ROOT = process.cwd();
const CI_ROOT = path.join(ROOT, "growth", "content-intelligence");
const STAGES = new Set(["preflight", "collect", "score", "plan", "draft", "validate", "run"]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function stageArg() {
  const first = process.argv[2];
  return STAGES.has(first) ? first : "run";
}

function reportDate() {
  const envDate = String(process.env.AUTOMATION_REPORT_DATE || "").trim();
  return envDate || today();
}

function isDryRun() {
  return String(process.env.DRY_RUN || "").toLowerCase() === "true";
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function writeJson(relativePath, data) {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2) + "\n");
}

function latestFile(directory, prefix) {
  const absoluteDirectory = path.join(ROOT, directory);
  if (!fs.existsSync(absoluteDirectory)) return null;
  const files = fs
    .readdirSync(absoluteDirectory)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .filter((file) => prefix !== "gsc-" || !file.startsWith("gsc-indexing-"))
    .sort();
  return files.length ? path.join(directory, files[files.length - 1]) : null;
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function hasEnv(name) {
  return String(process.env[name] || "").trim() !== "";
}

function shellQuote(value) {
  return JSON.stringify(String(value));
}

function isValidBlogSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

// Mixpanel and GSC are optional at this stage: the loop degrades to the
// deterministic seed topic pool until those providers are wired up.
async function mixpanelSmoke() {
  const username = optionalEnv("MIXPANEL_SERVICE_ACCOUNT_USERNAME");
  const secret = optionalEnv("MIXPANEL_SERVICE_ACCOUNT_SECRET");
  if (!username || !secret) {
    console.log("Mixpanel not configured; skipping smoke (falling back to seed topic pool).");
    return;
  }
  const auth = Buffer.from(`${username}:${secret}`).toString("base64");
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({ from_date: today, to_date: today, event: JSON.stringify(["blog_post_viewed"]) });
  const response = await fetch(`https://data.mixpanel.com/api/2.0/export?${params.toString()}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mixpanel preflight failed (${response.status}): ${text.slice(0, 200)}`);
  }
}

async function preflight() {
  if (!isDryRun()) {
    requireEnv("OPENCLAW_API_URL");
    requireEnv("OPENCLAW_API_KEY");
  }
  await mixpanelSmoke();
  if (hasEnv("GSC_SERVICE_ACCOUNT_JSON") || hasEnv("GOOGLE_SERVICE_ACCOUNT_PATH")) {
    run("npx tsx scripts/content-intelligence/pull-gsc.ts --test");
    run("npx tsx scripts/content-intelligence/pull-gsc-indexing.ts --test");
  } else {
    console.log("GSC not configured; skipping GSC preflight (falling back to seed topic pool).");
  }
  console.log("Weekly content intelligence preflight passed.");
}

function collect() {
  run("npx tsx scripts/content-intelligence/pull-mixpanel-blog.ts");
  run("npx tsx scripts/content-intelligence/pull-gsc.ts");
  run(`npx tsx scripts/content-intelligence/pull-gsc-indexing.ts${isDryRun() ? " --limit 5" : ""}`);
}

function score() {
  run("npx tsx scripts/content-intelligence/compute-scores.ts");
}

function plan() {
  run(`npx tsx scripts/content-intelligence/plan-topics.ts --date ${shellQuote(reportDate())}`);
}

function topicPlanPath() {
  const expected = path.join("growth", "content-intelligence", "analysis", `topics-${reportDate()}.json`);
  if (fs.existsSync(path.join(ROOT, expected))) return expected;
  const latest = latestFile("growth/content-intelligence/analysis", "topics-");
  if (!latest) throw new Error("No topic plan found. Run plan before draft.");
  return latest;
}

function relatedPostSummaries(slugs) {
  const registry = readJson("growth/content-intelligence/state/topic-registry.json");
  const entries = [...(registry.written || []), ...(registry.rejected || [])];
  return slugs.map((slug) => {
    const entry = entries.find((e) => e.slug === slug);
    return entry ? { slug, title: entry.title, category: entry.category, keyword: entry.keyword } : { slug, title: null };
  });
}

function updateTopicRegistry(entries) {
  if (entries.length === 0) return;
  const registryPath = path.join(CI_ROOT, "state", "topic-registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const existing = new Set((registry.written || []).map((entry) => entry.slug));
  for (const entry of entries) {
    if (!existing.has(entry.slug)) {
      registry.written.push(entry);
      existing.add(entry.slug);
    }
  }
  registry.lastUpdated = reportDate();
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
}

async function draftNewPost(topic, context) {
  const completion = await callOpenClawComplete({
    task: "checkfollows_draft_blog_post",
    style: "single seo blog post drafting",
    input: {
      report_date: reportDate(),
      topic,
      repo: "checkfollows",
      repo_ref: process.env.GITHUB_SHA || null,
      content_machine_skill: context.contentMachineSkill,
      indexing_copy_patterns: context.indexingCopyPatterns,
      quality_gates: context.qualityGates,
      related_posts: relatedPostSummaries(topic.relatedSlugs || []),
      instruction:
        "Draft exactly one complete CheckFollows blog post as a data object matching the BlogPost shape in src/lib/blog-posts.ts (slug, title, description, category, date, readTime, sections with heading/paragraphs/bullets, faq with question/answer, relatedSlugs). Preserve the slug, category, and relatedSlugs from the topic. Return only schema-valid JSON. LENGTH REQUIREMENT (non-negotiable): write 800-2500 words of body copy across the sections, excluding FAQ; target at least 900 words so you clear the 800-word validation floor with margin. Use at least 3 H2 sections and keep the first paragraph under 100 words. Do not write git commits or modify the repository yourself. Do not call web_search or any external provider; rely on the deterministic topic brief, supplied repo context, and general knowledge. The first paragraph must answer the factual query directly and name Instagram or the specific surface immediately. Do not open with reassurance or emotional validation.",
    },
    output_schema: {
      type: "object",
      additionalProperties: false,
      required: ["blog_entry", "topic_registry_entry", "summary"],
      properties: {
        blog_entry: {
          type: "object",
          additionalProperties: false,
          required: ["slug", "title", "description", "category", "date", "readTime", "sections"],
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            date: { type: "string" },
            readTime: { type: "string" },
            sections: { type: "array" },
            faq: { type: "array" },
            relatedSlugs: { type: "array", items: { type: "string" } },
          },
        },
        topic_registry_entry: {
          type: "object",
          additionalProperties: false,
          required: ["slug", "title", "keyword", "category", "addedWeek", "source", "generatedByLoop"],
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            keyword: { type: "string" },
            category: { type: "string" },
            addedWeek: { type: "string" },
            source: { type: "string" },
            generatedByLoop: { type: "boolean" },
          },
        },
        summary: { type: "string" },
      },
    },
  });

  const output = completion.output;
  if (output.blog_entry.slug !== topic.slug || output.topic_registry_entry.slug !== topic.slug) {
    throw new Error(`OpenClaw returned mismatched slug for ${topic.slug}`);
  }
  if (!isValidBlogSlug(output.blog_entry.slug)) {
    throw new Error(`OpenClaw returned invalid slug: ${output.blog_entry.slug}`);
  }
  return output;
}

async function draft() {
  const planPath = topicPlanPath();
  const topicPlan = readJson(planPath);
  const newTopics = topicPlan.newTopics || [];
  const refreshTargets = topicPlan.refreshTargets || [];
  if (topicPlan.blocked || newTopics.length === 0) {
    throw new Error(`Topic plan is blocked: ${topicPlan.sourceEvidence?.decision || "no publishable work"}`);
  }
  if (refreshTargets.length > 0) {
    console.log(`Refreshes are disabled for this run (${refreshTargets.length} candidate(s) ignored).`);
  }
  if (isDryRun()) {
    console.log(`DRY_RUN=true: planned ${newTopics.length} new post(s); skipping OpenClaw drafting.`);
    return;
  }

  const context = {
    contentMachineSkill: readText(".agents/skills/content/content-machine-page-generation/SKILL.md"),
    indexingCopyPatterns: readText(".agents/skills/content/content-intelligence-loop/references/indexing-copy-patterns.md"),
    qualityGates: readText(".agents/skills/content/content-intelligence-loop/references/quality-gates.md"),
  };

  const blogEntries = [];
  const topicRegistryEntries = [];
  const drafted = [];

  for (const topic of newTopics) {
    console.log(`Drafting new topic: ${topic.slug}`);
    const output = await draftNewPost(topic, context);
    console.log(`Drafted new topic: ${topic.slug}`);
    blogEntries.push(output.blog_entry);
    topicRegistryEntries.push(output.topic_registry_entry);
    drafted.push({ slug: topic.slug, summary: output.summary });
  }

  if (blogEntries.length === 0) {
    throw new Error("OpenClaw drafting produced no new slugs.");
  }

  const entriesPath = path.join("growth", "content-intelligence", `new-entries-${reportDate()}.json`);
  writeJson(entriesPath, blogEntries);
  run(`npx tsx scripts/content-intelligence/update-blog-registry.ts ${shellQuote(entriesPath)}`);
  updateTopicRegistry(topicRegistryEntries);

  writeJson(path.join("growth", "content-intelligence", "logs", `${reportDate()}-openclaw.json`), {
    automationId: "weekly-content-intelligence",
    reportDate: reportDate(),
    mode: "staged-deterministic-provider-reads",
    topicPlanPath: planPath,
    newSlugs: drafted.map((entry) => entry.slug),
    refreshedSlugs: [],
    drafted,
    summary: `Drafted ${drafted.length} new post(s) using staged OpenClaw calls.`,
  });
}

function validate() {
  const logPath = path.join("growth", "content-intelligence", "logs", `${reportDate()}-openclaw.json`);
  if (!fs.existsSync(path.join(ROOT, logPath))) {
    if (isDryRun()) {
      console.log("DRY_RUN=true: no draft log expected; skipping validation.");
      return;
    }
    throw new Error(`Missing ${logPath}. Run draft before validate.`);
  }

  const log = readJson(logPath);
  const slugs = [...(log.newSlugs || []), ...(log.refreshedSlugs || [])].filter(Boolean);
  if (slugs.length === 0) throw new Error(`${logPath} contains no slugs; refusing green weekly run.`);
  const slugArgs = slugs.map(shellQuote).join(" ");
  run(`npx tsx scripts/content-intelligence/validate-posts.ts ${slugArgs}`);
  run(`npx tsx scripts/content-intelligence/regenerate-sitemap.ts ${slugArgs}`);
  run(`npx tsx scripts/content-intelligence/regenerate-llms.ts`);
  run(`npx tsx scripts/content-intelligence/validate-llms.ts`);
}

async function main() {
  const stage = stageArg();
  process.env.AUTOMATION_REPORT_DATE = reportDate();

  if (stage === "preflight") return preflight();
  if (stage === "collect") return collect();
  if (stage === "score") return score();
  if (stage === "plan") return plan();
  if (stage === "draft") return draft();
  if (stage === "validate") return validate();

  await preflight();
  collect();
  score();
  plan();
  await draft();
  validate();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
