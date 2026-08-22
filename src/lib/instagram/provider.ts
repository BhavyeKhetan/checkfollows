/**
 * Instagram Provider Interface + Factory
 *
 * Architecture:
 *   Two providers for two different use cases:
 *
 *   getPreviewProvider()  — apify/instagram-profile-scraper
 *     Cheap profile-only lookup for unpaid landing-page searches.
 *     Returns profile data (counts, bio, avatar) — no follow lists.
 *
 *   getMonitoringProvider() — dead00/instagram-followers-following-scraper-no-cookies
 *     Full following/followers scrape for paid users.
 *     $0.29/1,000 profiles. Baseline, diffs, scheduled monitoring.
 *
 *   HikerAPI code preserved in src/lib/hikerapi.ts (reference only).
 */

// ─── Common types ─────────────────────────────────────────

export interface InstagramProfile {
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  biography: string | null;
  externalUrl: string | null;
  postsCount?: number;
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
  usernames: string[];
  dataToScrape: "Followings" | "Followers";
  maxResultsPerUser?: number;
}

export interface ScanOutput {
  success: boolean;
  entries: Map<string, InstagramUserEntry[]>;
  totalProfilesReturned: number;
  runMetadata: {
    provider: string;
    actorId?: string;
    runId?: string;
    status: string;
    error?: string;
    costEstimate?: number;
  };
}

// ─── Monitoring provider interface ────────────────────────

export interface InstagramProvider {
  readonly name: string;
  fetchProfile(username: string): Promise<InstagramProfile>;
  fetchFollowing(userId: string): Promise<InstagramUserEntry[]>;
  fetchFollowers(userId: string): Promise<InstagramUserEntry[]>;
  batchScan(input: ScanInput): Promise<ScanOutput>;
}

// ─── Preview provider interface ───────────────────────────

export interface PreviewProvider {
  readonly name: string;
  fetchProfile(username: string): Promise<InstagramProfile>;
  fetchProfiles(usernames: string[]): Promise<InstagramProfile[]>;
}

// ─── Factories ────────────────────────────────────────────

let cachedMonitoringProvider: InstagramProvider | null = null;
let cachedPreviewProvider: PreviewProvider | null = null;

export function getMonitoringProvider(): InstagramProvider {
  if (cachedMonitoringProvider) return cachedMonitoringProvider as InstagramProvider;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createApifyProvider } = require("./providers/apify");
  cachedMonitoringProvider = createApifyProvider();
  return cachedMonitoringProvider as InstagramProvider;
}

export function getPreviewProvider(): PreviewProvider {
  if (cachedPreviewProvider) return cachedPreviewProvider as PreviewProvider;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPreviewProvider } = require("./providers/preview");
  cachedPreviewProvider = createPreviewProvider();
  return cachedPreviewProvider as PreviewProvider;
}

/** @deprecated Use getMonitoringProvider() or getPreviewProvider() instead */
export function getInstagramProvider(): InstagramProvider {
  return getMonitoringProvider();
}

export function resetProviders(): void {
  cachedMonitoringProvider = null;
  cachedPreviewProvider = null;
}
