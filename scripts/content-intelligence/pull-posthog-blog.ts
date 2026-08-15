import * as fs from "fs";
import * as path from "path";

const ROOT = path.join(process.cwd(), "growth", "content-intelligence");

const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY || "";
const HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "";

function writeEmpty() {
  const today = new Date().toISOString().split("T")[0];
  const output = { pullDate: today, period: "30d", totalSlugs: 0, slugs: {}, note: "PostHog not configured; empty fallback." };
  const outPath = path.join(ROOT, "raw", `posthog-${today}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`PostHog not configured; wrote empty fallback to ${outPath}`);
}

async function hogqlQuery(query: string): Promise<any> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query }, refresh: "blocking" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${text}`);
  }
  return res.json();
}

interface SlugData {
  pageviews7d: number;
  pageviews30d: number;
  uniqueVisitors30d: number;
  avgSessionDuration: number;
  funnelEntries: number;
  funnelConversions: number;
  conversionRate: number;
}

function isValidBlogSlug(slug: string | null | undefined): slug is string {
  return !!slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

const SLUG_EXTRACT = "'^https?://[^/]+/blog/([^?#/]+).*$'";

async function pullPageviews(period: string): Promise<Record<string, { pageviews: number; uniqueVisitors: number }>> {
  const result = await hogqlQuery(`
    SELECT
      replaceRegexpOne(properties.$current_url, ${SLUG_EXTRACT}, '\\\\1') AS slug,
      count() AS pageviews,
      uniq(properties.distinct_id) AS unique_visitors
    FROM events
    WHERE event = '$pageview'
      AND properties.$current_url LIKE '%/blog/%'
      AND timestamp > now() - INTERVAL ${period}
    GROUP BY slug
    HAVING slug != ''
    ORDER BY pageviews DESC
  `);

  const data: Record<string, { pageviews: number; uniqueVisitors: number }> = {};
  for (const row of result.results || []) {
    if (isValidBlogSlug(row[0])) data[row[0]] = { pageviews: row[1], uniqueVisitors: row[2] };
  }
  return data;
}

async function pullEngagement(): Promise<Record<string, number>> {
  const result = await hogqlQuery(`
    SELECT
      replaceRegexpOne(properties.$current_url, ${SLUG_EXTRACT}, '\\\\1') AS slug,
      avg(toFloatOrDefault(toString(properties.$session_duration), 0.0)) AS avg_session_duration
    FROM events
    WHERE event = '$pageview'
      AND properties.$current_url LIKE '%/blog/%'
      AND timestamp > now() - INTERVAL 30 DAY
    GROUP BY slug
    HAVING slug != ''
  `);

  const data: Record<string, number> = {};
  for (const row of result.results || []) {
    if (isValidBlogSlug(row[0])) data[row[0]] = row[1] || 0;
  }
  return data;
}

async function pullFunnelConversions(): Promise<Record<string, { entries: number; conversions: number }>> {
  const result = await hogqlQuery(`
    SELECT
      entry_slug,
      count() AS entries,
      countIf(converted = 1) AS conversions
    FROM (
      SELECT
        properties.distinct_id AS did,
        argMin(
          replaceRegexpOne(properties.$current_url, ${SLUG_EXTRACT}, '\\\\1'),
          timestamp
        ) AS entry_slug,
        max(CASE WHEN event IN ('scan_started', 'signup_completed', 'payment_received') THEN 1 ELSE 0 END) AS converted
      FROM events
      WHERE timestamp > now() - INTERVAL 30 DAY
      GROUP BY did
      HAVING entry_slug != ''
    )
    GROUP BY entry_slug
  `);

  const data: Record<string, { entries: number; conversions: number }> = {};
  for (const row of result.results || []) {
    const slug = row[0];
    if (isValidBlogSlug(slug)) data[slug] = { entries: row[1], conversions: row[2] };
  }
  return data;
}

async function main() {
  if (!API_KEY || !PROJECT_ID) {
    writeEmpty();
    return;
  }

  console.log("Pulling PostHog blog data...");
  const [pv7d, pv30d, engagement, funnel] = await Promise.all([
    pullPageviews("7 DAY"),
    pullPageviews("30 DAY"),
    pullEngagement(),
    pullFunnelConversions(),
  ]);

  const allSlugs = new Set([...Object.keys(pv7d), ...Object.keys(pv30d), ...Object.keys(engagement), ...Object.keys(funnel)]);

  const slugs: Record<string, SlugData> = {};
  for (const slug of allSlugs) {
    const entries = funnel[slug]?.entries || 0;
    const conversions = funnel[slug]?.conversions || 0;
    slugs[slug] = {
      pageviews7d: pv7d[slug]?.pageviews || 0,
      pageviews30d: pv30d[slug]?.pageviews || 0,
      uniqueVisitors30d: pv30d[slug]?.uniqueVisitors || 0,
      avgSessionDuration: engagement[slug] || 0,
      funnelEntries: entries,
      funnelConversions: conversions,
      conversionRate: entries > 0 ? conversions / entries : 0,
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const output = { pullDate: today, period: "30d", totalSlugs: Object.keys(slugs).length, slugs };
  const outPath = path.join(ROOT, "raw", `posthog-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${Object.keys(slugs).length} slugs to ${outPath}`);
}

main().catch((err) => {
  console.error("PostHog pull failed:", err);
  writeEmpty();
});
