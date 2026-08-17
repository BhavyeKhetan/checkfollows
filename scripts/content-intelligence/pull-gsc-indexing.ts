import * as fs from "fs";
import * as path from "path";

const ROOT = path.join(process.cwd(), "growth", "content-intelligence");
const SITE_URL = process.env.GSC_SITE_URL || "sc-domain:checkfollows.com";
const BLOG_BASE_URL = "https://checkfollows.com/blog";
const DEFAULT_DELAY_MS = Number(process.env.GSC_URL_INSPECTION_DELAY_MS || 650);

interface RegistryEntry {
  slug: string;
  title?: string;
  keyword?: string;
  category?: string;
  addedWeek?: string;
  source?: string;
}

function isValidBlogSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function hasGscCredentials(): boolean {
  return !!(
    process.env.GSC_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
    fs.existsSync(path.join(process.cwd(), "credentials", "gsc-service-account.json"))
  );
}

function readRegistrySlugs(): string[] {
  const registryPath = path.join(ROOT, "state", "topic-registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8")) as { written: RegistryEntry[] };
  return (registry.written || []).map((entry) => entry.slug).filter(isValidBlogSlug).sort();
}

function writeEmpty() {
  const today = new Date().toISOString().split("T")[0];
  const output = {
    pullDate: today,
    siteUrl: SITE_URL,
    source: "google_search_console_url_inspection",
    totalAvailableSlugs: readRegistrySlugs().length,
    totalInspected: 0,
    totalFailed: 0,
    coverageCounts: {},
    pages: {},
    note: "GSC not configured; empty fallback.",
  };
  const outPath = path.join(ROOT, "raw", `gsc-indexing-${today}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`GSC not configured; wrote empty indexing fallback to ${outPath}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const isTest = args.includes("--test");
  const limitFlagIndex = args.indexOf("--limit");
  const limit = limitFlagIndex >= 0 && args[limitFlagIndex + 1] ? Number(args[limitFlagIndex + 1]) : Number(process.env.GSC_URL_INSPECTION_LIMIT || 0);
  return { isTest, limit: Number.isFinite(limit) && limit > 0 ? limit : null };
}

async function main() {
  const { isTest, limit } = parseArgs();

  if (!hasGscCredentials()) {
    if (isTest) {
      console.log("GSC not configured; test skipped.");
      return;
    }
    writeEmpty();
    return;
  }

  const { google } = await import("googleapis");
  const SERVICE_ACCOUNT_PATH = path.resolve(
    process.cwd(),
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH || "credentials/gsc-service-account.json",
  );
  const auth = new google.auth.GoogleAuth({
    credentials: process.env.GSC_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON)
      : JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const slugs = readRegistrySlugs();
  const targetSlugs = limit ? slugs.slice(0, limit) : slugs;
  if (targetSlugs.length === 0) {
    console.error("No blog slugs found for URL Inspection.");
    process.exit(1);
  }

  async function inspectUrl(slug: string) {
    const url = `${BLOG_BASE_URL}/${slug}`;
    try {
      const res = await searchconsole.urlInspection.index.inspect({
        requestBody: { siteUrl: SITE_URL, inspectionUrl: url },
      });
      const indexStatus = res.data.inspectionResult?.indexStatusResult || {};
      return {
        slug,
        url,
        inspectedAt: new Date().toISOString(),
        verdict: indexStatus.verdict || null,
        coverageState: indexStatus.coverageState || null,
        robotsTxtState: indexStatus.robotsTxtState || null,
        indexingState: indexStatus.indexingState || null,
        pageFetchState: indexStatus.pageFetchState || null,
        googleCanonical: indexStatus.googleCanonical || null,
        userCanonical: indexStatus.userCanonical || null,
        lastCrawlTime: indexStatus.lastCrawlTime || null,
        referringUrls: indexStatus.referringUrls || [],
        error: null,
      };
    } catch (err: any) {
      return {
        slug,
        url,
        inspectedAt: new Date().toISOString(),
        verdict: null,
        coverageState: null,
        robotsTxtState: null,
        indexingState: null,
        pageFetchState: null,
        googleCanonical: null,
        userCanonical: null,
        lastCrawlTime: null,
        referringUrls: [],
        error: err?.message || String(err),
      };
    }
  }

  if (isTest) {
    const result = await inspectUrl(targetSlugs[0]);
    if (result.error) {
      console.error(`GSC URL Inspection connection failed for ${targetSlugs[0]}: ${result.error}`);
      process.exit(1);
    }
    console.log(`GSC URL Inspection connection OK for ${targetSlugs[0]}: ${result.coverageState || result.verdict || "unknown"}`);
    return;
  }

  const pages: Record<string, any> = {};
  const coverageCounts: Record<string, number> = {};
  let failed = 0;

  for (const [idx, slug] of targetSlugs.entries()) {
    const result = await inspectUrl(slug);
    pages[slug] = result;
    const coverageKey = result.coverageState || (result.error ? "inspection_error" : "unknown");
    coverageCounts[coverageKey] = (coverageCounts[coverageKey] || 0) + 1;
    if (result.error) failed += 1;
    console.log(`[${idx + 1}/${targetSlugs.length}] ${slug}: ${coverageKey}${result.error ? ` (${result.error})` : ""}`);
    if (idx < targetSlugs.length - 1 && DEFAULT_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_DELAY_MS));
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const output = {
    pullDate: today,
    siteUrl: SITE_URL,
    source: "google_search_console_url_inspection",
    totalAvailableSlugs: slugs.length,
    totalInspected: targetSlugs.length,
    totalFailed: failed,
    coverageCounts,
    pages,
  };
  const outPath = path.join(ROOT, "raw", `gsc-indexing-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${targetSlugs.length} URL Inspection results to ${outPath}`);
}

main().catch((err) => {
  console.error("GSC URL Inspection pull failed:", err);
  if (!process.argv.includes("--test")) writeEmpty();
  else process.exit(1);
});
