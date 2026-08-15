import fs from "node:fs";
import path from "node:path";
import { run } from "./lib/policy.mjs";

const ROOT = process.cwd();
const reportDate = String(process.env.AUTOMATION_REPORT_DATE || "").trim() || new Date().toISOString().slice(0, 10);
const logPath = path.join(ROOT, "growth", "content-intelligence", "logs", `${reportDate}-openclaw.json`);

if (!fs.existsSync(logPath)) {
  console.log(`No content intelligence log found for ${reportDate}; skipping search submission.`);
  process.exit(0);
}

const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const slugs = [...(log.newSlugs || []), ...(log.refreshedSlugs || [])].filter(Boolean);

if (slugs.length === 0) {
  console.log(`No slugs found in ${path.relative(ROOT, logPath)}; skipping search submission.`);
  process.exit(0);
}

run(`npx tsx scripts/content-intelligence/submit-search-engines.ts ${slugs.map((slug) => JSON.stringify(slug)).join(" ")}`);
