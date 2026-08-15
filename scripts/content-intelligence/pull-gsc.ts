import * as fs from "fs";
import * as path from "path";

const ROOT = path.join(process.cwd(), "growth", "content-intelligence");
const SITE_URL = process.env.GSC_SITE_URL || "https://checkfollows.com/";

function hasGscCredentials(): boolean {
  return !!(
    process.env.GSC_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
    (process.env.GOOGLE_SERVICE_ACCOUNT_PATH
      ? false
      : fs.existsSync(path.join(process.cwd(), "credentials", "gsc-service-account.json")))
  );
}

function writeEmpty() {
  const today = new Date().toISOString().split("T")[0];
  const output = { pullDate: today, period: "not pulled", totalPages: 0, pages: {}, note: "GSC not configured; empty fallback." };
  const outPath = path.join(ROOT, "raw", `gsc-${today}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`GSC not configured; wrote empty fallback to ${outPath}`);
}

function extractSlug(url: string): string | null {
  const match = url.match(/\/blog\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function main() {
  const isTest = process.argv.includes("--test");

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

  async function getAuth(): Promise<any> {
    const keyFile = process.env.GSC_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON)
      : JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
    return new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
  }

  const auth = await getAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  if (isTest) {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const res = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { startDate, endDate, dimensions: ["page"], rowLimit: 10, dataState: "all" },
    });
    console.log(`GSC connection OK. Found ${(res.data.rows || []).length} pages in the last 7 days.`);
    return;
  }

  const endDate = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  console.log(`Pulling GSC data for ${startDate} to ${endDate}...`);

  const [pageRes, queryRes] = await Promise.all([
    searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { startDate, endDate, dimensions: ["page"], rowLimit: 5000, dataState: "all" },
    }),
    searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { startDate, endDate, dimensions: ["page", "query"], rowLimit: 10000, dataState: "all" },
    }),
  ]);

  const pages: Record<string, { clicks: number; impressions: number; ctr: number; avgPosition: number; topQueries: string[] }> = {};
  for (const row of pageRes.data.rows || []) {
    const keys = row.keys;
    if (!keys || keys.length === 0) continue;
    const slug = extractSlug(keys[0]);
    if (!slug) continue;
    pages[slug] = {
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      avgPosition: row.position ?? 0,
      topQueries: [],
    };
  }

  const queryMap: Record<string, { query: string; clicks: number }[]> = {};
  for (const row of queryRes.data.rows || []) {
    const keys = row.keys;
    if (!keys || keys.length < 2) continue;
    const slug = extractSlug(keys[0]);
    if (!slug) continue;
    if (!queryMap[slug]) queryMap[slug] = [];
    queryMap[slug].push({ query: keys[1], clicks: row.clicks ?? 0 });
  }

  for (const [slug, queries] of Object.entries(queryMap)) {
    if (pages[slug]) {
      pages[slug].topQueries = queries.sort((a, b) => b.clicks - a.clicks).slice(0, 10).map((q) => q.query);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const output = { pullDate: today, period: `${startDate} to ${endDate}`, totalPages: Object.keys(pages).length, pages };
  const outPath = path.join(ROOT, "raw", `gsc-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${Object.keys(pages).length} pages to ${outPath}`);
}

main().catch((err) => {
  console.error("GSC pull failed:", err);
  if (!process.argv.includes("--test")) writeEmpty();
  else process.exit(1);
});
