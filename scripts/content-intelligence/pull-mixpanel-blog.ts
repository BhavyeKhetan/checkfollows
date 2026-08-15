import * as fs from "fs";
import * as path from "path";

/**
 * Pulls per-blog-slug metrics from Mixpanel (the sole product-analytics tool
 * for CheckFollows) via the Export API, then aggregates in Node. This replaces
 * the retired PostHog puller and keeps the exact output shape that
 * `compute-scores.ts` consumes.
 *
 * Read-back requires a Mixpanel service account (the public project token is
 * ingestion-only and cannot read data). Until those credentials are provided
 * the script writes an empty fallback and the weekly loop degrades to the
 * seed topic pool.
 */

const ROOT = path.join(process.cwd(), "growth", "content-intelligence");

const SERVICE_ACCOUNT_USERNAME = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME || "";
const SERVICE_ACCOUNT_SECRET = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET || "";
const EXPORT_URL = "https://data.mixpanel.com/api/2.0/export";

const CONVERSION_EVENTS = ["sign_up_completed", "subscription_activated"];
const DAY_MS = 86400000;

interface RawEvent {
  event: string;
  properties: {
    distinct_id?: string;
    time?: number;
    slug?: string;
    [k: string]: unknown;
  };
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

function dateNDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().split("T")[0];
}

function writeEmpty(note: string): void {
  const today = new Date().toISOString().split("T")[0];
  const output = {
    pullDate: today,
    period: "30d",
    totalSlugs: 0,
    slugs: {},
    note,
  };
  const outPath = path.join(ROOT, "raw", `mixpanel-${today}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Mixpanel not configured (${note}); wrote empty fallback to ${outPath}`);
}

function isValidBlogSlug(slug: string | null | undefined): slug is string {
  return !!slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

async function exportEvents(fromDate: string, toDate: string): Promise<RawEvent[]> {
  const auth = Buffer.from(
    `${SERVICE_ACCOUNT_USERNAME}:${SERVICE_ACCOUNT_SECRET}`
  ).toString("base64");

  // Export only the events we care about: blog views plus the conversion
  // signals used to compute the blog → signup/activation funnel.
  const params = new URLSearchParams({
    from_date: fromDate,
    to_date: toDate,
    event: JSON.stringify(["blog_post_viewed", ...CONVERSION_EVENTS]),
  });

  const res = await fetch(`${EXPORT_URL}?${params.toString()}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mixpanel export failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const text = await res.text();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as RawEvent);
}

/**
 * Aggregate raw events into the per-slug shape `compute-scores.ts` expects.
 * Pure and deterministic so it can be unit-tested with a fixture.
 */
export function aggregate(events: RawEvent[]): Record<string, SlugData> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * DAY_MS;

  const views: Record<string, { pv30: number; pv7: number; uv30: Set<string> }> = {};

  // Funnel: per distinct_id, first blog view = entry slug; converted if any
  // conversion event happened at or after that entry.
  const users = new Map<
    string,
    { entrySlug: string; entryTime: number; converted: boolean }
  >();

  const sorted = [...events].sort(
    (a, b) => (a.properties.time || 0) - (b.properties.time || 0)
  );

  for (const evt of sorted) {
    const p = evt.properties || {};
    const did = p.distinct_id;
    const t = (p.time || 0) * 1000;

    if (evt.event === "blog_post_viewed") {
      const slug = p.slug;
      if (!isValidBlogSlug(slug)) continue;
      const bucket = views[slug] || (views[slug] = { pv30: 0, pv7: 0, uv30: new Set() });
      bucket.pv30 += 1;
      if (t >= sevenDaysAgo) bucket.pv7 += 1;
      if (did) bucket.uv30.add(did);

      if (did) {
        const user = users.get(did);
        if (!user || t < user.entryTime) {
          users.set(did, { entrySlug: slug, entryTime: t, converted: user?.converted || false });
        }
      }
    } else if (CONVERSION_EVENTS.includes(evt.event)) {
      if (!did) continue;
      const user = users.get(did);
      if (user && t >= user.entryTime) {
        user.converted = true;
      }
    }
  }

  const funnelBySlug: Record<string, { entries: number; conversions: number }> = {};
  for (const user of users.values()) {
    const bucket =
      funnelBySlug[user.entrySlug] ||
      (funnelBySlug[user.entrySlug] = { entries: 0, conversions: 0 });
    bucket.entries += 1;
    if (user.converted) bucket.conversions += 1;
  }

  const slugs: Record<string, SlugData> = {};
  for (const [slug, bucket] of Object.entries(views)) {
    const funnel = funnelBySlug[slug] || { entries: 0, conversions: 0 };
    slugs[slug] = {
      pageviews7d: bucket.pv7,
      pageviews30d: bucket.pv30,
      uniqueVisitors30d: bucket.uv30.size,
      avgSessionDuration: 0,
      funnelEntries: funnel.entries,
      funnelConversions: funnel.conversions,
      conversionRate: funnel.entries > 0 ? funnel.conversions / funnel.entries : 0,
    };
  }
  return slugs;
}

async function main(): Promise<void> {
  if (!SERVICE_ACCOUNT_USERNAME || !SERVICE_ACCOUNT_SECRET) {
    writeEmpty("MIXPANEL_SERVICE_ACCOUNT_USERNAME/SECRET not set");
    return;
  }

  console.log("Pulling Mixpanel blog data...");
  const events = await exportEvents(dateNDaysAgo(30), dateNDaysAgo(0));
  const slugs = aggregate(events);

  const today = new Date().toISOString().split("T")[0];
  const output = { pullDate: today, period: "30d", totalSlugs: Object.keys(slugs).length, slugs };
  const outPath = path.join(ROOT, "raw", `mixpanel-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${Object.keys(slugs).length} slugs to ${outPath}`);
}

main().catch((err) => {
  console.error("Mixpanel pull failed:", err);
  writeEmpty("pull failed");
});
