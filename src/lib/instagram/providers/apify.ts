/**
 * Apify Provider — dead00/instagram-followers-following-scraper-no-cookies
 *
 * Actor: https://apify.com/dead00/instagram-followers-following-scraper-no-cookies
 * Pricing: $0.20 / 1,000 delivered Instagram profiles
 * Works on PUBLIC accounts only — no cookies/credentials needed.
 *
 * Dataset item fields:
 *   sourceUsername, type, userId, username, fullName, isPrivate, isVerified, profilePicUrl
 */

import type {
  InstagramProvider,
  InstagramProfile,
  InstagramUserEntry,
  ScanInput,
  ScanOutput,
} from "../provider";

const APIFY_API_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "dead00~instagram-followers-following-scraper-no-cookies";

// ─── Config ───────────────────────────────────────────────

interface ApifyConfig {
  token: string;
  actorId: string;
  /** Max seconds to wait for actor run to finish */
  waitTimeoutSecs: number;
  /** Poll interval in seconds */
  pollIntervalSecs: number;
  /** Batch size for multi-username runs */
  maxBatchSize: number;
}

function getConfig(): ApifyConfig {
  const token =
    process.env.APIFY_API_TOKEN ||
    process.env.APIFY_TOKEN ||
    process.env.APIFY_TRANSCRIPT_API_KEY ||
    "";
  if (!token) throw new Error("Apify token not configured");

  return {
    token,
    actorId: process.env.APIFY_INSTAGRAM_ACTOR || ACTOR_ID,
    waitTimeoutSecs: parseInt(process.env.APIFY_WAIT_TIMEOUT || "300", 10),
    pollIntervalSecs: parseInt(process.env.APIFY_POLL_INTERVAL || "10", 10),
    maxBatchSize: parseInt(process.env.APIFY_MAX_BATCH_SIZE || "15", 10),
  };
}

// ─── Types for actor input/output ─────────────────────────

interface ApifyActorInput {
  usernames: string[];
  dataToScrape: "Followings" | "Followers";
  maxResultsPerUser: number;
}

interface ApifyDatasetItem {
  sourceUsername: string;
  type: "follower" | "following";
  userId: string;
  username: string;
  fullName: string;
  isPrivate: boolean;
  isVerified: boolean;
  profilePicUrl: string;
}

// ─── API helpers ──────────────────────────────────────────

async function startActorRun(
  input: ApifyActorInput,
  config: ApifyConfig
): Promise<{ runId: string }> {
  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(config.actorId)}/runs?token=${encodeURIComponent(config.token)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify run start failed (${res.status}): ${body}`);
  }

  const run = await res.json();
  const runId = run?.data?.id;
  if (!runId) throw new Error("No run ID returned from Apify");

  return { runId };
}

async function waitForRun(
  runId: string,
  config: ApifyConfig
): Promise<{
  status: string;
  defaultDatasetId?: string;
  errorMessage?: string;
}> {
  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(config.actorId)}/runs/${runId}?token=${encodeURIComponent(config.token)}`;
  const deadline = Date.now() + config.waitTimeoutSecs * 1000;

  while (Date.now() < deadline) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Apify run status check failed (${res.status})`);
    }

    const run = await res.json();
    const status = run?.data?.status;

    if (status === "SUCCEEDED") {
      return {
        status: "SUCCEEDED",
        defaultDatasetId: run?.data?.defaultDatasetId,
      };
    }

    if (
      status === "FAILED" ||
      status === "ABORTED" ||
      status === "TIMED-OUT"
    ) {
      return {
        status,
        errorMessage: run?.data?.errorMessage || `Run ${status.toLowerCase()}`,
      };
    }

    // Still running — wait and poll again
    await new Promise((resolve) =>
      setTimeout(resolve, config.pollIntervalSecs * 1000)
    );
  }

  return { status: "TIMED-OUT", errorMessage: "Run timed out waiting for completion" };
}

async function getDatasetItems(
  datasetId: string,
  config: ApifyConfig
): Promise<ApifyDatasetItem[]> {
  const url = `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(config.token)}&clean=true&format=json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Apify dataset fetch failed (${res.status})`);
  }

  const items: ApifyDatasetItem[] = await res.json();
  return items;
}

// ─── Normalization ────────────────────────────────────────

function toProviderEntry(item: ApifyDatasetItem): InstagramUserEntry {
  return {
    userId: item.userId,
    username: item.username,
    fullName: item.fullName || null,
    avatarUrl: item.profilePicUrl || null,
    isPrivate: item.isPrivate,
    isVerified: item.isVerified,
  };
}

function groupBySourceUsername(
  items: ApifyDatasetItem[]
): Map<string, InstagramUserEntry[]> {
  const map = new Map<string, InstagramUserEntry[]>();
  for (const item of items) {
    const key = item.sourceUsername.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(toProviderEntry(item));
  }
  return map;
}

// ─── Provider implementation ──────────────────────────────

export function createApifyProvider(): InstagramProvider {
  const config = getConfig();

  const provider: InstagramProvider = {
    name: "apify",

    async fetchProfile(username: string): Promise<InstagramProfile> {
      // Use the actor to get profile data by scraping a single username
      // The actor doesn't have a dedicated profile endpoint, but running
      // with maxResultsPerUser=1 gives us enough metadata.
      const clean = username.replace(/^@/, "").trim();

      const result = await provider.batchScan({
        usernames: [clean],
        dataToScrape: "Followings",
        maxResultsPerUser: 1,
      });

      if (!result.success) {
        throw new Error(
          result.runMetadata.error || "Failed to fetch profile"
        );
      }

      const entries = result.entries.get(clean.toLowerCase());
      if (!entries || entries.length === 0) {
        // Check if account doesn't exist — the actor returns empty results for non-existent accounts
        throw new Error("Account not found");
      }

      // We don't get follower/following counts from this actor directly.
      // For profile display, we fetch the profile via the first entry's metadata.
      // The counts will be populated from the last snapshot or from a separate API call.
      const first = entries[0];

      return {
        userId: first.userId,
        username: clean,
        fullName: first.fullName,
        avatarUrl: first.avatarUrl,
        isPrivate: first.isPrivate,
        isVerified: first.isVerified,
        followerCount: 0, // Will be populated from snapshot
        followingCount: entries.length, // We fetched following, so this is the count
        biography: null,
        externalUrl: null,
      };
    },

    async fetchFollowing(userId: string): Promise<InstagramUserEntry[]> {
      // This method needs the actual Instagram numeric userId (not username)
      // For the dead00 actor, we need usernames. This method is primarily
      // used by the monitoring engine which has access to target.username.
      // If called directly, we'd need the username — this is a design constraint.
      throw new Error(
        "fetchFollowing by userId not supported with Apify provider. Use batchScan with usernames."
      );
    },

    async fetchFollowers(userId: string): Promise<InstagramUserEntry[]> {
      throw new Error(
        "fetchFollowers by userId not supported with Apify provider. Use batchScan with usernames."
      );
    },

    async batchScan(input: ScanInput): Promise<ScanOutput> {
      const cleanUsernames = input.usernames.map((u) =>
        u.replace(/^@/, "").trim().toLowerCase()
      );

      if (cleanUsernames.length === 0) {
        return {
          success: false,
          entries: new Map(),
          totalProfilesReturned: 0,
          runMetadata: {
            provider: "apify",
            status: "FAILED",
            error: "No usernames provided",
          },
        };
      }

      if (cleanUsernames.length > config.maxBatchSize) {
        return {
          success: false,
          entries: new Map(),
          totalProfilesReturned: 0,
          runMetadata: {
            provider: "apify",
            status: "FAILED",
            error: `Batch size ${cleanUsernames.length} exceeds max ${config.maxBatchSize}`,
          },
        };
      }

      const actorInput: ApifyActorInput = {
        usernames: cleanUsernames,
        dataToScrape: input.dataToScrape,
        maxResultsPerUser: input.maxResultsPerUser ?? 0,
      };

      try {
        // Start the actor run
        const { runId } = await startActorRun(actorInput, config);

        // Wait for completion
        const runResult = await waitForRun(runId, config);

        if (runResult.status !== "SUCCEEDED" || !runResult.defaultDatasetId) {
          return {
            success: false,
            entries: new Map(),
            totalProfilesReturned: 0,
            runMetadata: {
              provider: "apify",
              actorId: config.actorId,
              runId,
              status: runResult.status,
              error: runResult.errorMessage,
            },
          };
        }

        // Fetch dataset items
        const items = await getDatasetItems(runResult.defaultDatasetId, config);

        // Group by source username
        const entries = groupBySourceUsername(items);

        // Calculate cost estimate: $0.20 per 1,000 profiles
        const costEstimate = (items.length / 1000) * 0.2;

        return {
          success: true,
          entries,
          totalProfilesReturned: items.length,
          runMetadata: {
            provider: "apify",
            actorId: config.actorId,
            runId,
            status: "SUCCEEDED",
            costEstimate,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
          success: false,
          entries: new Map(),
          totalProfilesReturned: 0,
          runMetadata: {
            provider: "apify",
            actorId: config.actorId,
            status: "FAILED",
            error: message,
          },
        };
      }
    },
  };

  return provider;
}
