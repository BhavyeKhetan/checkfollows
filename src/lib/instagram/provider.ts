/**
 * Instagram Provider Interface + Factory
 *
 * Architecture:
 *   All provider-specific code lives in /providers/*.ts.
 *   The rest of the app calls getInstagramProvider().
 *
 * Supported providers:
 *   - apify: dead00/instagram-followers-following-scraper-no-cookies (primary)
 *   - hikerapi: HikerAPI v2 (fallback, kept for reference)
 */

// ─── Common types used across providers ───────────────────

export interface InstagramProfile {
  userId: string; // Instagram numeric ID (PK)
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  biography: string | null;
  externalUrl: string | null;
}

export interface InstagramUserEntry {
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
}

export interface ScanInput {
  /** Single username OR array of usernames for batch */
  usernames: string[];
  /** "Followings" | "Followers" */
  dataToScrape: "Followings" | "Followers";
  /** 0 = no limit */
  maxResultsPerUser?: number;
}

export interface ScanOutput {
  success: boolean;
  /** Map of sourceUsername → list of entries */
  entries: Map<string, InstagramUserEntry[]>;
  /** Total profiles returned across all targets */
  totalProfilesReturned: number;
  /** Provider-specific run metadata */
  runMetadata: {
    provider: string;
    actorId?: string;
    runId?: string;
    status: string;
    error?: string;
    costEstimate?: number;
  };
}

// ─── Provider interface ───────────────────────────────────

export interface InstagramProvider {
  readonly name: string;

  /** Fetch a single profile by username */
  fetchProfile(username: string): Promise<InstagramProfile>;

  /** Fetch following list for a user (by Instagram numeric userId) */
  fetchFollowing(userId: string): Promise<InstagramUserEntry[]>;

  /** Fetch followers list for a user (by Instagram numeric userId) */
  fetchFollowers(userId: string): Promise<InstagramUserEntry[]>;

  /** Run a batch scan for multiple usernames — returns entries grouped by sourceUsername */
  batchScan(input: ScanInput): Promise<ScanOutput>;
}

// ─── Factory ──────────────────────────────────────────────

let cachedProvider: InstagramProvider | null = null;

export function getInstagramProvider(): InstagramProvider {
  if (cachedProvider) return cachedProvider as InstagramProvider;

  const providerName = process.env.INSTAGRAM_PROVIDER || "apify";

  // Dynamic import to avoid bundling unused providers
  switch (providerName) {
    case "hikerapi":
      // Kept for reference — needs valid HikerAPI key
      throw new Error(
        "HikerAPI is disabled. Set INSTAGRAM_PROVIDER=apify or configure HikerAPI key."
      );
    case "apify":
    default: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createApifyProvider } = require("./providers/apify");
      cachedProvider = createApifyProvider();
      return cachedProvider as InstagramProvider;
    }
  }
}

/** Reset cached provider (useful for tests) */
export function resetProvider(): void {
  cachedProvider = null;
}
