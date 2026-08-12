/**
 * HikerAPI — Primary Instagram data provider for CheckFollows.
 *
 * Endpoints:
 *   GET /user/by/username?username=xxx     → profile info + Instagram user ID
 *   GET /user/following?id=INSTAGRAM_ID    → paginated following list
 *   GET /user/followers?id=INSTAGRAM_ID    → paginated followers list
 *
 * Docs: https://hikerapi.com/instagram-followers-api
 */

const HIKER_BASE = process.env.HIKERAPI_BASE_URL || "https://api.hikerapi.com/v1";
const HIKER_KEY = process.env.HIKERAPI_API_KEY || "";

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

interface HikerPaginatedResponse<T> {
  users: T[];
  pagination_token: string | null;
  big_list: boolean;
  page_size: number;
}

function headers(): Record<string, string> {
  return {
    "x-access-key": HIKER_KEY,
    "Content-Type": "application/json",
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

  return res.json();
}

export async function fetchFollowing(
  instagramUserId: string,
  maxPages = 20
): Promise<HikerUserEntry[]> {
  const all: HikerUserEntry[] = [];
  let token: string | null = null;
  let pages = 0;

  do {
    const params = new URLSearchParams({ id: instagramUserId });
    if (token) params.set("pagination_token", token);

    const url = `${HIKER_BASE}/user/following?${params.toString()}`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      const body = await res.text();
      throw new HikerAPIError(
        `HikerAPI following fetch failed (${res.status}): ${body}`,
        res.status
      );
    }

    const data: HikerPaginatedResponse<HikerUserEntry> = await res.json();
    all.push(...data.users);
    token = data.pagination_token;
    pages++;

    // Safety: stop if no token or we've hit the limit
    if (!token || pages >= maxPages) break;
  } while (true);

  return all;
}

export async function fetchFollowers(
  instagramUserId: string,
  maxPages = 20
): Promise<HikerUserEntry[]> {
  const all: HikerUserEntry[] = [];
  let token: string | null = null;
  let pages = 0;

  do {
    const params = new URLSearchParams({ id: instagramUserId });
    if (token) params.set("pagination_token", token);

    const url = `${HIKER_BASE}/user/followers?${params.toString()}`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      const body = await res.text();
      throw new HikerAPIError(
        `HikerAPI followers fetch failed (${res.status}): ${body}`,
        res.status
      );
    }

    const data: HikerPaginatedResponse<HikerUserEntry> = await res.json();
    all.push(...data.users);
    token = data.pagination_token;
    pages++;

    if (!token || pages >= maxPages) break;
  } while (true);

  return all;
}

/**
 * Test if HikerAPI is configured and reachable.
 */
export async function testConnection(): Promise<boolean> {
  if (!HIKER_KEY) return false;
  try {
    const res = await fetch(`${HIKER_BASE}/user/by/username?username=instagram`, {
      headers: headers(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
