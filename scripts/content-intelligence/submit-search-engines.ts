import * as fs from "fs";
import * as path from "path";

const SITE = "https://checkfollows.com";
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const GSC_SITE_URL = process.env.GSC_SITE_URL || "https://checkfollows.com/";
const PUBLIC_DIR = path.join(process.cwd(), "public");

function hasGscCredentials(): boolean {
  return !!(
    process.env.GSC_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
    fs.existsSync(path.join(process.cwd(), "credentials", "gsc-service-account.json"))
  );
}

async function submitSitemapToGSC() {
  if (!hasGscCredentials()) {
    console.log("GSC not configured; skipping sitemap submission.");
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
    scopes: ["https://www.googleapis.com/auth/webmasters"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  await searchconsole.sitemaps.submit({ siteUrl: GSC_SITE_URL, feedpath: SITEMAP_URL });
  console.log(`GSC: submitted ${SITEMAP_URL} for site ${GSC_SITE_URL}`);
}

function readIndexNowKey(): string | null {
  const envKey = process.env.INDEXNOW_KEY || "";
  if (/^[a-f0-9]{32}$/i.test(envKey)) return envKey;
  if (!fs.existsSync(PUBLIC_DIR)) return null;
  const fileName = fs.readdirSync(PUBLIC_DIR).find((entry) => /^[a-f0-9]{32}\.txt$/i.test(entry));
  if (!fileName) return null;
  const key = fs.readFileSync(path.join(PUBLIC_DIR, fileName), "utf8").trim();
  return /^[a-f0-9]{32}$/i.test(key) ? key : null;
}

async function pingIndexNow(slugs: string[]) {
  const key = readIndexNowKey();
  if (!key) {
    console.log("IndexNow: INDEXNOW_KEY not set and no public key file found — skipping.");
    return;
  }
  const urlList = slugs.map((s) => `${SITE}/blog/${s}`);
  const body = { host: "checkfollows.com", key, keyLocation: `${SITE}/${key}.txt`, urlList };
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IndexNow returned ${res.status}: ${text}`);
  }
  console.log(`IndexNow: submitted ${urlList.length} URLs (status ${res.status}).`);
}

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error("Usage: npx tsx submit-search-engines.ts slug1 slug2 ...");
    process.exit(1);
  }

  let failed = false;
  try {
    await submitSitemapToGSC();
  } catch (err: any) {
    console.error("GSC submit failed:", err.message || err);
    failed = true;
  }
  try {
    await pingIndexNow(slugs);
  } catch (err: any) {
    console.error("IndexNow ping failed:", err.message || err);
    failed = true;
  }
  process.exit(failed ? 1 : 0);
}

main();
