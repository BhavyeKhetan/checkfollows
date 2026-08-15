import * as fs from "fs";
import * as path from "path";

const REGISTRY_PATH = path.join(process.cwd(), "src", "lib", "blog-posts.ts");

interface NewEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readTime: string;
  sections: unknown[];
  faq?: unknown[];
  relatedSlugs?: string[];
}

function serializeEntry(entry: NewEntry): string {
  // JSON is a valid TypeScript object literal. Re-indent to sit at 2-space
  // array nesting and add a trailing comma.
  const json = JSON.stringify(entry, null, 2);
  return json.split("\n").map((line) => "  " + line).join("\n") + ",";
}

export function addEntries(entries: NewEntry[]) {
  const content = fs.readFileSync(REGISTRY_PATH, "utf8");

  const existingSlugs = new Set<string>();
  for (const m of content.matchAll(/slug:\s*['"]([^'"]+)['"]/g)) {
    existingSlugs.add(m[1]);
  }

  const newEntries = entries.filter((e) => !existingSlugs.has(e.slug));
  if (newEntries.length === 0) {
    console.log("No new entries to add (all slugs already exist)");
    return;
  }

  const insertions = newEntries.map(serializeEntry).join("\n");

  const closingIndex = content.lastIndexOf("];");
  if (closingIndex === -1) {
    throw new Error("Could not find closing ]; in blog-posts.ts");
  }

  const updated = content.slice(0, closingIndex) + insertions + "\n" + content.slice(closingIndex);
  fs.writeFileSync(REGISTRY_PATH, updated);
  console.log(`Added ${newEntries.length} entries to blog-posts.ts`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("update-blog-registry.ts");
if (isMain) {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx update-blog-registry.ts entries.json");
    process.exit(1);
  }
  const entries: NewEntry[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  addEntries(entries);
}
