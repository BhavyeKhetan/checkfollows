/**
 * HikerAPI v2 — Primary Instagram data provider for CheckFollows.
 *
 * Endpoints:
 *   GET /v2/user/by/username?username=xxx       → { user: { pk, username, full_name, ... } }
 *   GET /v2/user/following?user_id=N            → { response: [...], next_page_id: "..." }
 *   GET /v2/user/followers?user_id=N            → { response: [...], next_page_id: "..." }
 *
 * Auth: x-access-key header
 * Docs: https://hikerapi.com
 */

const HIKER_BASE = process.env.HIKERAPI_BASE_URL || "https://api.hikerapi.com/v2";
const HIKER_KEY = process.env.HIKERAPI_API_KEY || "";

// ─── v2 Response types ────────────────────────────────────

interface HikerV2ProfileResponse {
  user: {
    pk: number;
    username: string;
    full_name: string;
    is_private: boolean;
    is_verified: boolean;
    profile_pic_url: string;
    follower_count: number;
    following_count: number;
    biography: string;
    external_url: string;
  };
}

interface HikerV2UserEntry {
  pk: number;
  username: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
}

interface HikerV2ListResponse {
  response: HikerV2UserEntry[];
  next_page_id: string | null;
}

// ─── Public types (used by monitoring.ts) ────────────────

export interface HikerProfile {
  pk: string;
  username: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
  follower_count: number;
  following_count: number;
  biography: string;
  external_url: string;
}

export interface HikerUserEntry {
  pk: string;
  username: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
}

// ─── Helpers ──────────────────────────────────────────────

function headers(): Record<string, string> {
  return {
    "x-access-key": HIKER_KEY,
    accept: "application/json",
  };
}

class HikerAPIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HikerAPIError";
    this.status = status;
  }
}

function toPublicProfile(raw: HikerV2ProfileResponse["user"]): HikerProfile {
  return {
    pk: String(raw.pk),
    username: raw.username,
    full_name: raw.full_name,
    is_private: raw.is_private,
    is_verified: raw.is_verified,
    profile_pic_url: raw.profile_pic_url,
    follower_count: raw.follower_count,
    following_count: raw.following_count,
    biography: raw.biography || "",
    external_url: raw.external_url || "",
  };
}

function toPublicEntry(raw: HikerV2UserEntry): HikerUserEntry {
  return {
    pk: String(raw.pk),
    username: raw.username,
    full_name: raw.full_name,
    is_private: raw.is_private,
    is_verified: raw.is_verified,
    profile_pic_url: raw.profile_pic_url,
  };
}

// ─── Public API functions ─────────────────────────────────

export async function fetchProfileByUsername(
  username: string
): Promise<HikerProfile> {
  const clean = username.replace(/^@/, "").trim();
  const url = `${HIKER_BASE}/user/by/username?username=${encodeURIComponent(clean)}`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new HikerAPIError(
      `HikerAPI profile fetch failed (${res.status}): ${body}`,
      res.status
    );
  }

  const data: HikerV2ProfileResponse = await res.json();
  if (!data.user) {
    throw new HikerAPIError("Profile not found", 404);
  }

  return toPublicProfile(data.user);
}

export async function fetchFollowing(
  instagramUserId: string,
  maxPages = 20
): Promise<HikerUserEntry[]> {
  const all: HikerUserEntry[] = [];
  let nextPageId: string | null = null;
  let pages = 0;

  do {
    const params = new URLSearchParams({ user_id: instagramUserId });
    if (nextPageId) params.set("next_page_id", nextPageId);

    const url = `${HIKER_BASE}/user/following?${params.toString()}`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      const body = await res.text();
      throw new HikerAPIError(
        `HikerAPI following fetch failed (${res.status}): ${body}`,
        res.status
      );
    }

    const data: HikerV2ListResponse = await res.json();
    if (data.response) {
      all.push(...data.response.map(toPublicEntry));
    }
    nextPageId = data.next_page_id;
    pages++;

    if (!nextPageId || pages >= maxPages) break;
  } while (true);

  return all;
}

export async function fetchFollowers(
  instagramUserId: string,
  maxPages = 20
): Promise<HikerUserEntry[]> {
  const all: HikerUserEntry[] = [];
  let nextPageId: string | null = null;
  let pages = 0;

  do {
    const params = new URLSearchParams({ user_id: instagramUserId });
    if (nextPageId) params.set("next_page_id", nextPageId);

    const url = `${HIKER_BASE}/user/followers?${params.toString()}`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      const body = await res.text();
      throw new HikerAPIError(
        `HikerAPI followers fetch failed (${res.status}): ${body}`,
        res.status
      );
    }

    const data: HikerV2ListResponse = await res.json();
    if (data.response) {
      all.push(...data.response.map(toPublicEntry));
    }
    nextPageId = data.next_page_id;
    pages++;

    if (!nextPageId || pages >= maxPages) break;
  } while (true);

  return all;
}
