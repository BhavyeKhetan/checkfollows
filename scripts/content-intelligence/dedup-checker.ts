import * as fs from "fs";
import * as path from "path";

const ROOT = path.join(process.cwd(), "growth", "content-intelligence");

function bigrams(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const bg = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    bg.add(`${words[i]} ${words[i + 1]}`);
  }
  return bg;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function levenshteinNormalized(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  const la = al.length;
  const lb = bl.length;
  if (la === 0 && lb === 0) return 1;

  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = al[i - 1] === bl[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return 1 - dp[la][lb] / Math.max(la, lb);
}

export interface DedupResult {
  pass: boolean;
  closestMatch: string;
  similarity: number;
  matchType: "title" | "keyword";
}

export function checkDedup(
  candidateTitle: string,
  candidateKeyword: string,
  threshold?: number,
): DedupResult {
  const configPath = path.join(ROOT, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const maxSimilarity = threshold ?? config.dedupThreshold;

  const registryPath = path.join(ROOT, "state", "topic-registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

  const allEntries = [...(registry.written || []), ...(registry.rejected || [])];
  const candidateBigrams = bigrams(candidateTitle);

  let highestSimilarity = 0;
  let closestMatch = "";
  let matchType: "title" | "keyword" = "title";

  for (const entry of allEntries) {
    const titleSim = jaccardSimilarity(candidateBigrams, bigrams(entry.title || ""));
    if (titleSim > highestSimilarity) {
      highestSimilarity = titleSim;
      closestMatch = entry.title;
      matchType = "title";
    }

    if (candidateKeyword && entry.keyword) {
      const kwSim = levenshteinNormalized(candidateKeyword, entry.keyword);
      if (kwSim > highestSimilarity) {
        highestSimilarity = kwSim;
        closestMatch = entry.keyword;
        matchType = "keyword";
      }
    }
  }

  return {
    pass: highestSimilarity <= maxSimilarity,
    closestMatch,
    similarity: Math.round(highestSimilarity * 100) / 100,
    matchType,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith("dedup-checker.ts");
if (isMain) {
  const title = process.argv[2];
  const keyword = process.argv[3] || "";
  if (!title) {
    console.error('Usage: npx tsx dedup-checker.ts "Candidate Title" "candidate keyword"');
    process.exit(1);
  }
  const result = checkDedup(title, keyword);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}
