/**
 * Instagram username and profile URL normalization utilities.
 */

const RESERVED_IG_ROUTES = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "direct",
  "accounts",
  "developer",
  "about",
  "legal",
  "directory",
  "channel",
  "tv",
]);

/**
 * Extracts and cleans an Instagram username from raw user input.
 * Supports:
 * - Direct handles: "username", "@username", "@@username"
 * - Trailing slashes / whitespace: "  username/ "
 * - Web / mobile URLs: "https://www.instagram.com/username/"
 * - URLs without protocol: "instagram.com/username", "www.instagram.com/username"
 * - Share links with query params: "https://instagram.com/username?igsh=..."
 * - Story URLs: "https://instagram.com/stories/username/123456789/"
 * - Deep link app formats: "https://instagram.com/_u/username"
 * - Threads profile links: "https://threads.net/@username"
 */
export function extractInstagramUsername(input: string | null | undefined): string {
  if (!input) return "";

  let raw = String(input).trim();
  if (!raw) return "";

  // Remove common wrapping characters like quotes, brackets, angle brackets
  raw = raw.replace(/^["'<(\[]+|["'>)\]]+$/g, "").trim();

  // If input contains a URL pattern or slash
  if (
    /^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,}\/)/i.test(raw) ||
    raw.includes("instagram.com") ||
    raw.includes("instagr.am") ||
    raw.includes("threads.net") ||
    raw.includes("/")
  ) {
    try {
      const urlString = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
      const parsed = new URL(urlString);
      const segments = parsed.pathname.split("/").filter(Boolean);

      if (segments.length > 0) {
        const first = segments[0].toLowerCase();
        
        // Handle /stories/username/...
        if (first === "stories" && segments.length > 1) {
          raw = segments[1];
        } else if (first === "_u" && segments.length > 1) {
          // Handle /_u/username
          raw = segments[1];
        } else if (RESERVED_IG_ROUTES.has(first)) {
          // It's a non-profile route like /p/post_id or /explore
          return "";
        } else {
          raw = segments[0];
        }
      }
    } catch {
      // Fallback regex if URL parsing fails
      const match = raw.match(/(?:instagram\.com|instagr\.am)\/(?:stories\/|_u\/)?([a-zA-Z0-9._]+)/i);
      if (match && match[1] && !RESERVED_IG_ROUTES.has(match[1].toLowerCase())) {
        raw = match[1];
      }
    }
  }

  // Strip query strings and hash fragments if leftover
  raw = raw.split("?")[0].split("#")[0];

  // Strip leading @, trailing slashes, and dots at edges
  raw = raw.replace(/^@+/, "").replace(/\/+$/, "").trim().toLowerCase();

  return raw;
}

/**
 * Validates whether the extracted string is a valid Instagram username.
 * Instagram usernames:
 * - 1 to 30 characters
 * - letters (a-z), numbers (0-9), periods (.), underscores (_)
 */
export function isValidInstagramUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  const clean = extractInstagramUsername(username);
  if (!clean || clean.length < 1 || clean.length > 30) return false;
  return /^[a-zA-Z0-9._]{1,30}$/.test(clean);
}
