/**
 * Preview Provider — apify/instagram-profile-scraper
 *
 * Actor: https://apify.com/apify/instagram-profile-scraper
 * Official Apify actor. Lightweight profile-only lookup.
 * Much cheaper than dead00 for landing-page searches.
 *
 * Returns: id, username, fullName, biography, followersCount, followsCount,
 *          private, verified, profilePicUrl, externalUrl, etc.
 *
 * Does NOT return following/followers lists — use the monitoring provider for that.
 */

import type { InstagramProfile } from "../provider";

const APIFY_API_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-profile-scraper";

// ─── Config ───────────────────────────────────────────────

interface PreviewConfig {
  token: string;
  actorId: string;
  waitTimeoutSecs: number;
  pollIntervalSecs: number;
}

function getConfig(): PreviewConfig {
  const token =
    process.env.APIFY_API_TOKEN ||
    process.env.APIFY_TOKEN ||
    process.env.APIFY_TRANSCRIPT_API_KEY ||
    "";
  if (!token) throw new Error("Apify token not configured");

  return {
    token,
    actorId: process.env.APIFY_PREVIEW_ACTOR || ACTOR_ID,
    waitTimeoutSecs: parseInt(process.env.APIFY_PREVIEW_WAIT_TIMEOUT || "60", 10),
    pollIntervalSecs: parseInt(process.env.APIFY_PREVIEW_POLL_INTERVAL || "3", 10),
  };
}

// ─── Actor response types ─────────────────────────────────

interface PreviewDatasetItem {
  inputUrl: string;
  id: string;
  username: string;
  url: string;
  fullName: string;
  biography: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  private: boolean;
  verified: boolean;
  profilePicUrl: string;
  profilePicUrlHD: string;
  externalUrl: string | null;
  isBusinessAccount: boolean;
  businessCategoryName: string | null;
}

// ─── API helpers ──────────────────────────────────────────

async function startRun(
  usernames: string[],
  config: PreviewConfig
): Promise<string> {
  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(config.actorId)}/runs?token=${encodeURIComponent(config.token)}`;

  const input = {
    usernames,
    // Only fetch profile data, not posts
    scrapePosts: false,
    scrapeStories: false,
    scrapeHighlights: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Preview actor start failed (${res.status}): ${body}`);
  }

  const run = await res.json();
  const runId = run?.data?.id;
  if (!runId) throw new Error("No run ID returned from preview actor");

  return runId;
}

async function waitForCompletion(
  runId: string,
  config: PreviewConfig
): Promise<string | null> {
  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(config.actorId)}/runs/${runId}?token=${encodeURIComponent(config.token)}`;
  const deadline = Date.now() + config.waitTimeoutSecs * 1000;

  while (Date.now() < deadline) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Preview status check failed (${res.status})`);

    const run = await res.json();
    const status = run?.data?.status;

    if (status === "SUCCEEDED") {
      return run?.data?.defaultDatasetId || null;
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      return null;
    }

    await new Promise((r) => setTimeout(r, config.pollIntervalSecs * 1000));
  }

  return null;
}

async function fetchItems(
  datasetId: string,
  config: PreviewConfig
): Promise<PreviewDatasetItem[]> {
  const url = `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(config.token)}&clean=true&format=json`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Preview dataset fetch failed (${res.status})`);
  }

  return res.json();
}

// ─── Normalization ────────────────────────────────────────

function toProfile(item: PreviewDatasetItem): InstagramProfile {
  return {
    userId: item.id,
    username: item.username,
    fullName: item.fullName || null,
    avatarUrl: item.profilePicUrlHD || item.profilePicUrl || null,
    isPrivate: item.private,
    isVerified: item.verified,
    followerCount: item.followersCount || 0,
    followingCount: item.followsCount || 0,
    biography: item.biography || null,
    externalUrl: item.externalUrl || null,
  };
}

// ─── Exported functions ───────────────────────────────────

export interface PreviewProvider {
  readonly name: string;

  /** Fetch profile for a single username (lightweight, cheap) */
  fetchProfile(username: string): Promise<InstagramProfile>;

  /** Fetch profiles for multiple usernames */
  fetchProfiles(usernames: string[]): Promise<InstagramProfile[]>;
}

export function createPreviewProvider(): PreviewProvider {
  const config = getConfig();

  async function fetchProfiles(
    usernames: string[]
  ): Promise<InstagramProfile[]> {
    const clean = usernames.map((u) => u.replace(/^@/, "").trim().toLowerCase());

    if (clean.length === 0) return [];

    try {
      const runId = await startRun(clean, config);
      const datasetId = await waitForCompletion(runId, config);

      if (!datasetId) {
        return [];
      }

      const items = await fetchItems(datasetId, config);
      return items.map(toProfile);
    } catch (err) {
      console.error("Preview provider error:", err);
      return [];
    }
  }

  return {
    name: "apify-preview",

    async fetchProfile(username: string): Promise<InstagramProfile> {
      const profiles = await fetchProfiles([username]);
      if (profiles.length === 0) {
        throw new Error("Account not found");
      }
      const profile = profiles[0];
      if (profile.isPrivate) {
        throw new Error("This account is private");
      }
      return profile;
    },

    fetchProfiles,
  };
}
