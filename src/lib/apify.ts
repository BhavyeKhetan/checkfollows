import type { InstagramProfile, FollowEntry, ApiProfileResponse, ApiFollowsResponse } from "./types";

const APIFY_API_BASE = "https://api.apify.com/v2";

// Default Instagram scraper actor — configurable via env
const INSTAGRAM_SCRAPER_ACTOR =
  process.env.INSTAGRAM_APIFY_ACTOR || "apify~instagram-scraper";

function getToken(): string {
  const token =
    process.env.APIFY_API_TOKEN ||
    process.env.APIFY_TOKEN ||
    process.env.APIFY_TRANSCRIPT_API_KEY ||
    "";
  if (!token) throw new Error("Apify token not configured");
  return token;
}

// ─── Profile Lookup ────────────────────────────────────────────────

export async function fetchInstagramProfile(
  username: string
): Promise<ApiProfileResponse> {
  const token = getToken();
  const cleanUsername = username.replace(/^@/, "").trim();

  const startUrl = `https://www.instagram.com/${encodeURIComponent(cleanUsername)}/`;

  const runInput = {
    directUrls: [startUrl],
    resultsType: "details",
    resultsLimit: 1,
    searchType: "user",
  };

  // Start actor run
  const runRes = await fetch(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(INSTAGRAM_SCRAPER_ACTOR)}/runs?token=${encodeURIComponent(token)}&waitForFinish=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runInput),
    }
  );

  if (!runRes.ok) {
    console.error("Apify run failed:", runRes.status);
    return { success: false, error: "Failed to fetch profile data" };
  }

  const run = await runRes.json();
  const runId = run?.data?.id;
  if (!runId) {
    return { success: false, error: "No run ID returned from Apify" };
  }

  // Check status
  const status = run?.data?.status;
  if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
    return { success: false, error: `Scraper run ${status.toLowerCase()}` };
  }

  // Fetch dataset
  const datasetId = run?.data?.defaultDatasetId;
  if (!datasetId) {
    return { success: false, error: "No dataset returned" };
  }

  const itemsRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true`
  );
  if (!itemsRes.ok) {
    return { success: false, error: "Failed to fetch profile items" };
  }

  const items = await itemsRes.json();
  const profile = normalizeProfile(items, cleanUsername);

  if (!profile) {
    return { success: false, notFound: true, error: "Account not found" };
  }

  if (profile.isPrivate) {
    return {
      success: true,
      profile,
      isPrivate: true,
      detectedAt: new Date().toISOString(),
    };
  }

  return {
    success: true,
    profile,
    detectedAt: new Date().toISOString(),
  };
}

function normalizeProfile(
  items: Record<string, any>[],
  username: string
): InstagramProfile | null {
  if (!items || items.length === 0) return null;

  // Try multiple possible response shapes
  const item = items[0];
  const data = item?.data || item?.graphql?.user || item;

  if (!data || (!data.username && !data.full_name && !data.id)) return null;

  return {
    username: data.username || username,
    fullName: data.full_name || data.fullName || null,
    avatarUrl:
      data.profile_pic_url_hd ||
      data.profile_pic_url ||
      data.avatarUrl ||
      null,
    followerCount: data.edge_followed_by?.count || data.follower_count || data.followersCount || 0,
    followingCount: data.edge_follow?.count || data.following_count || data.followingCount || 0,
    isPrivate: data.is_private || data.isPrivate || false,
    isVerified: data.is_verified || data.isVerified || false,
    biography: data.biography || data.bio || null,
    externalUrl: data.external_url || data.externalUrl || null,
  };
}

// ─── Following / Followers ─────────────────────────────────────────

export async function fetchFollowData(
  username: string
): Promise<ApiFollowsResponse> {
  const token = getToken();
  const cleanUsername = username.replace(/^@/, "").trim();

  const startUrl = `https://www.instagram.com/${encodeURIComponent(cleanUsername)}/`;

  const runInput = {
    directUrls: [startUrl],
    resultsType: "posts",
    resultsLimit: 1,
    searchType: "user",
    // Extended scraping for follows
    extendOutputFunction: `
      async ({ data, item, helpers, page, customData, Apify }) => {
        return item;
      }
    `,
  };

  // Start actor run with following/followers scraping
  const runRes = await fetch(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(INSTAGRAM_SCRAPER_ACTOR)}/runs?token=${encodeURIComponent(token)}&waitForFinish=300`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runInput),
    }
  );

  if (!runRes.ok) {
    return { success: false, error: "Failed to fetch follow data" };
  }

  const run = await runRes.json();
  const runId = run?.data?.id;
  if (!runId) {
    return { success: false, error: "No run ID" };
  }

  const datasetId = run?.data?.defaultDatasetId;
  if (!datasetId) {
    return { success: false, error: "No dataset" };
  }

  const itemsRes = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true`
  );
  if (!itemsRes.ok) {
    return { success: false, error: "Failed to fetch follow items" };
  }

  const items = await itemsRes.json();
  return normalizeFollowData(items);
}

function normalizeFollowData(
  items: Record<string, any>[]
): ApiFollowsResponse {
  if (!items || items.length === 0) {
    return { success: false, error: "No data returned" };
  }

  const data = items[0];
  const user =
    data?.graphql?.user ||
    data?.data?.user ||
    data?.data ||
    data;

  // Extract edges in order (usually newest-first)
  const followingEdges =
    user?.edge_follow?.edges ||
    user?.following?.edges ||
    user?.following ||
    [];

  const followerEdges =
    user?.edge_followed_by?.edges ||
    user?.followers?.edges ||
    user?.followers ||
    [];

  const normalizeEdge = (edge: any): FollowEntry | null => {
    const node = edge?.node || edge;
    if (!node?.username) return null;
    return {
      id: node.id || node.username || String(Math.random()),
      username: node.username,
      fullName: node.full_name || node.fullName || null,
      avatarUrl:
        node.profile_pic_url ||
        node.profile_pic_url_hd ||
        node.avatarUrl ||
        null,
      isVerified: node.is_verified || node.isVerified || false,
      isPrivate: node.is_private || node.isPrivate || false,
    };
  };

  // Limit to 50 entries each for performance
  const following = followingEdges
    .map(normalizeEdge)
    .filter(Boolean)
    .slice(0, 50) as FollowEntry[];

  const followers = followerEdges
    .map(normalizeEdge)
    .filter(Boolean)
    .slice(0, 50) as FollowEntry[];

  return {
    success: true,
    recentFollowing: following,
    recentFollowers: followers,
    detectedAt: new Date().toISOString(),
  };
}

// ─── Health check ──────────────────────────────────────────────────

export function getApifyStatus(): { configured: boolean; actor: string } {
  try {
    const token = getToken();
    return { configured: !!token, actor: INSTAGRAM_SCRAPER_ACTOR };
  } catch {
    return { configured: false, actor: INSTAGRAM_SCRAPER_ACTOR };
  }
}
