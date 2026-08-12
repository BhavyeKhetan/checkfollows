/**
 * Monitoring Engine — Snapshot + diff engine + scheduler for CheckFollows.
 *
 * Architecture (Apify primary):
 *   1. Scan target(s) → batch fetch current Following list via Apify
 *   2. First scan = BASELINE (no events generated)
 *   3. Subsequent scans → diff against previous snapshot → generate events
 *   4. Snapshot validation → suspect detection (>20% reduction triggers retry)
 *   5. Two-observation confirmation for STOPPED_FOLLOWING events
 *   6. Cost instrumentation per scan
 *
 * Key concepts:
 *   - BASELINE: first successful scan. No events. Just stores data.
 *   - NEW_FOLLOWING: accepted after one successful scan (less risky)
 *   - STOPPED_FOLLOWING: candidate on first observation, confirmed on second
 *   - SUSPECT: >20% reduction from previous count triggers verification
 */

import { createServerClient } from "@/lib/supabase/server";
import { getInstagramProvider } from "@/lib/instagram/provider";
import type { InstagramUserEntry } from "@/lib/instagram/provider";

// ─── Config ───────────────────────────────────────────────

const SUSPECT_THRESHOLD = parseFloat(
  process.env.SUSPECT_THRESHOLD_PCT || "0.20"
);
const BATCH_SIZE = parseInt(process.env.MONITORING_BATCH_SIZE || "10", 10);

// ─── Types ────────────────────────────────────────────────

export interface ScanResult {
  scanId: string;
  targetId: string;
  status: "completed" | "failed" | "suspect";
  events: FollowEvent[];
  error?: string;
}

export interface FollowEvent {
  eventType:
    | "NEW_FOLLOWING"
    | "STOPPED_FOLLOWING"
    | "NEW_FOLLOWER"
    | "LOST_FOLLOWER";
  instagramId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  confirmed: boolean;
}

// ─── Snapshots table row shape (for type narrowing) ───────

interface SnapshotRow {
  id: string;
  target_id: string;
  snapshot_type: string;
  account_ids: string[];
  account_usernames: string[];
  captured_at: string;
  scan_id: string;
}

// ─── Helpers ──────────────────────────────────────────────

function buildUserMap(
  users: InstagramUserEntry[]
): Map<string, InstagramUserEntry> {
  const map = new Map<string, InstagramUserEntry>();
  for (const u of users) {
    map.set(u.userId, u);
  }
  return map;
}

function diffLists(
  previous: Map<string, InstagramUserEntry>,
  current: Map<string, InstagramUserEntry>,
  addEventType: FollowEvent["eventType"],
  removeEventType: FollowEvent["eventType"]
): FollowEvent[] {
  const events: FollowEvent[] = [];

  for (const [id, entry] of current) {
    if (!previous.has(id)) {
      events.push({
        eventType: addEventType,
        instagramId: id,
        username: entry.username,
        fullName: entry.fullName,
        avatarUrl: entry.avatarUrl,
        isVerified: entry.isVerified,
        confirmed: false,
      });
    }
  }

  for (const [id, entry] of previous) {
    if (!current.has(id)) {
      events.push({
        eventType: removeEventType,
        instagramId: id,
        username: entry.username,
        fullName: entry.fullName,
        avatarUrl: entry.avatarUrl,
        isVerified: entry.isVerified,
        confirmed: false,
      });
    }
  }

  return events;
}

function buildUserIdList(users: InstagramUserEntry[]): string[] {
  return users.map((u) => u.userId);
}

function buildUsernameList(users: InstagramUserEntry[]): string[] {
  return users.map((u) => u.username);
}

// ─── Snapshot Validation ──────────────────────────────────

function isSuspectResult(
  currentCount: number,
  previousCount: number | null
): boolean {
  if (previousCount === null || previousCount === 0) return false;
  const reduction = (previousCount - currentCount) / previousCount;
  return reduction > SUSPECT_THRESHOLD;
}

// ─── Get latest non-suspect snapshot ──────────────────────

async function getLatestValidSnapshot(
  supabase: ReturnType<typeof createServerClient>,
  targetId: string,
  type: "following" | "followers"
): Promise<SnapshotRow | null> {
  // Get recent snapshots, then filter out ones from suspect scans
  const { data: snapshots } = await supabase
    .from("follow_snapshots")
    .select("id, target_id, snapshot_type, account_ids, account_usernames, captured_at, scan_id")
    .eq("target_id", targetId)
    .eq("snapshot_type", type)
    .order("captured_at", { ascending: false })
    .limit(3);

  if (!snapshots || snapshots.length === 0) return null;

  // Check each snapshot's associated scan for suspect flag
  for (const snap of snapshots) {
    const { data: scan } = await supabase
      .from("scans")
      .select("suspect")
      .eq("id", snap.scan_id)
      .maybeSingle();

    if (scan && !scan.suspect) {
      return snap;
    }
  }

  return null;
}

// ─── Store baseline snapshot (for initial scan) ───────────

async function storeBaselineSnapshot(
  targetId: string,
  entries: InstagramUserEntry[],
  providerName: string
): Promise<string> {
  const supabase = createServerClient();

  // Create scan record
  const { data: scan } = await supabase
    .from("scans")
    .insert({
      target_id: targetId,
      status: "running",
      started_at: new Date().toISOString(),
      provider: providerName,
      api_cost: 0,
      target_count: 1,
      profiles_returned: entries.length,
      suspect: false,
    })
    .select("id")
    .single();

  if (!scan) throw new Error("Failed to create scan record");

  // Store snapshot
  await supabase.from("follow_snapshots").insert({
    target_id: targetId,
    snapshot_type: "following",
    account_ids: buildUserIdList(entries),
    account_usernames: buildUsernameList(entries),
    scan_id: scan.id,
  });

  // Mark scan complete
  await supabase
    .from("scans")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", scan.id);

  // Set last_scanned_at + next_scan_at on target
  await supabase
    .from("instagram_targets")
    .update({
      last_scanned_at: new Date().toISOString(),
      next_scan_at: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetId);

  return scan.id;
}

// ─── Upsert Target ────────────────────────────────────────

export async function upsertInstagramTarget(profile: {
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
}): Promise<{
  id: string;
  instagram_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_private: boolean;
  is_verified: boolean;
  following_count: number;
  follower_count: number;
} | null> {
  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("instagram_targets")
    .select("id, monitoring_enabled")
    .eq("instagram_id", profile.userId)
    .maybeSingle();

  if (existing) {
    const { data } = await supabase
      .from("instagram_targets")
      .update({
        username: profile.username,
        full_name: profile.fullName,
        avatar_url: profile.avatarUrl,
        is_private: profile.isPrivate,
        is_verified: profile.isVerified,
        following_count: profile.followingCount,
        follower_count: profile.followerCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select(
        "id, instagram_id, username, full_name, avatar_url, is_private, is_verified, following_count, follower_count"
      )
      .single();

    return data;
  }

  const { data } = await supabase
    .from("instagram_targets")
    .insert({
      instagram_id: profile.userId,
      username: profile.username,
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      is_private: profile.isPrivate,
      is_verified: profile.isVerified,
      following_count: profile.followingCount,
      follower_count: profile.followerCount,
      scan_interval_hours: 24,
      monitoring_enabled: false,
    })
    .select(
      "id, instagram_id, username, full_name, avatar_url, is_private, is_verified, following_count, follower_count"
    )
    .single();

  return data;
}

// ─── Core: Scan Following (single target) ─────────────────

export async function scanFollowing(targetId: string): Promise<ScanResult> {
  const supabase = createServerClient();
  const provider = getInstagramProvider();

  const { data: target } = await supabase
    .from("instagram_targets")
    .select("*")
    .eq("id", targetId)
    .single();

  if (!target) {
    return {
      scanId: "",
      targetId,
      status: "failed",
      events: [],
      error: "Target not found",
    };
  }

  const { data: scan } = await supabase
    .from("scans")
    .insert({
      target_id: targetId,
      status: "running",
      started_at: new Date().toISOString(),
      provider: provider.name,
      api_cost: 0,
      target_count: 1,
      profiles_returned: 0,
      suspect: false,
    })
    .select("id")
    .single();

  if (!scan) {
    return {
      scanId: "",
      targetId,
      status: "failed",
      events: [],
      error: "Failed to create scan record",
    };
  }

  try {
    const result = await provider.batchScan({
      usernames: [target.username],
      dataToScrape: "Followings",
      maxResultsPerUser: 0,
    });

    if (!result.success) {
      throw new Error(result.runMetadata.error || "Apify scan failed");
    }

    const entries = result.entries.get(target.username.toLowerCase()) || [];
    const currentCount = entries.length;

    await supabase
      .from("scans")
      .update({
        profiles_returned: result.totalProfilesReturned,
        actor_id: result.runMetadata.actorId || null,
        run_id: result.runMetadata.runId || null,
        api_cost: result.runMetadata.costEstimate || 0,
      })
      .eq("id", scan.id);

    // Get most recent valid (non-suspect) snapshot
    const prevSnapshot = await getLatestValidSnapshot(
      supabase,
      targetId,
      "following"
    );
    const previousCount = prevSnapshot?.account_ids?.length ?? null;

    // ─── Snapshot validation ─────────────────────────────
    if (isSuspectResult(currentCount, previousCount)) {
      await supabase
        .from("scans")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          suspect: true,
          error_message: `Suspect: ${previousCount} → ${currentCount} (${Math.round((1 - currentCount / (previousCount || 1)) * 100)}% reduction)`,
        })
        .eq("id", scan.id);

      await supabase
        .from("instagram_targets")
        .update({
          next_scan_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);

      return {
        scanId: scan.id,
        targetId,
        status: "suspect",
        events: [],
        error: `Suspect scan: ${previousCount} → ${currentCount}`,
      };
    }

    const currentMap = buildUserMap(entries);
    let events: FollowEvent[] = [];

    // ─── BASELINE or DIFF ────────────────────────────────
    const isBaseline = !prevSnapshot;

    if (!isBaseline) {
      const prevMap = new Map<string, InstagramUserEntry>();
      for (let i = 0; i < prevSnapshot.account_ids.length; i++) {
        prevMap.set(prevSnapshot.account_ids[i], {
          userId: prevSnapshot.account_ids[i],
          username: prevSnapshot.account_usernames[i] || "",
          fullName: null,
          avatarUrl: null,
          isPrivate: false,
          isVerified: false,
        });
      }

      events = diffLists(
        prevMap,
        currentMap,
        "NEW_FOLLOWING",
        "STOPPED_FOLLOWING"
      );
    }

    // Store new snapshot
    const { data: newSnapshot } = await supabase
      .from("follow_snapshots")
      .insert({
        target_id: targetId,
        snapshot_type: "following",
        account_ids: buildUserIdList(entries),
        account_usernames: buildUsernameList(entries),
        scan_id: scan.id,
      })
      .select("id")
      .single();

    if (!isBaseline && events.length > 0 && newSnapshot) {
      const eventRows = events.map((e) => ({
        target_id: targetId,
        event_type: e.eventType,
        instagram_id: e.instagramId,
        username: e.username,
        full_name: e.fullName,
        avatar_url: e.avatarUrl,
        is_verified: e.isVerified,
        confirmed: false,
        previous_snapshot_id: prevSnapshot?.id || null,
        current_snapshot_id: newSnapshot.id,
      }));

      await supabase.from("follow_events").insert(eventRows);
    }

    // ─── Confirm events ──────────────────────────────────
    if (prevSnapshot) {
      // NEW_FOLLOWING: confirm immediately (single observation)
      const { data: unconfirmedNewFollows } = await supabase
        .from("follow_events")
        .select("id, instagram_id")
        .eq("target_id", targetId)
        .eq("confirmed", false)
        .eq("event_type", "NEW_FOLLOWING")
        .eq("current_snapshot_id", prevSnapshot.id);

      if (unconfirmedNewFollows && unconfirmedNewFollows.length > 0) {
        const currentIds = new Set(entries.map((u) => u.userId));
        const toConfirm = unconfirmedNewFollows
          .filter((evt) => currentIds.has(evt.instagram_id))
          .map((evt) => evt.id);

        if (toConfirm.length > 0) {
          await supabase
            .from("follow_events")
            .update({ confirmed: true })
            .in("id", toConfirm);
        }
      }

      // STOPPED_FOLLOWING: candidate → confirmed after one more valid scan
      // Check events from the previous snapshot: if account is still absent, confirm.
      // Two observations: (1) account disappeared in prev scan, (2) still missing now.
      const { data: candidateRemovals } = await supabase
        .from("follow_events")
        .select("id, instagram_id")
        .eq("target_id", targetId)
        .eq("confirmed", false)
        .eq("event_type", "STOPPED_FOLLOWING")
        .eq("current_snapshot_id", prevSnapshot.id);

      if (candidateRemovals && candidateRemovals.length > 0) {
        const currentIds = new Set(entries.map((u) => u.userId));
        const toConfirm = candidateRemovals
          .filter((evt) => !currentIds.has(evt.instagram_id))
          .map((evt) => evt.id);

        if (toConfirm.length > 0) {
          await supabase
            .from("follow_events")
            .update({ confirmed: true })
            .in("id", toConfirm);
        }
      }
    }

    // Schedule next scan
    const intervalHours = target.monitoring_interval_hours || 24;
    const nextScanAt = new Date(
      Date.now() + intervalHours * 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("instagram_targets")
      .update({
        last_scanned_at: new Date().toISOString(),
        next_scan_at: nextScanAt,
        following_count: currentCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId);

    await supabase
      .from("scans")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", scan.id);

    return {
      scanId: scan.id,
      targetId,
      status: "completed",
      events,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    const failBackoffHours = Math.min(
      (target.scan_interval_hours || 24) * 2,
      24
    );
    const nextRetryAt = new Date(
      Date.now() + failBackoffHours * 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("instagram_targets")
      .update({
        next_scan_at: nextRetryAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId);

    await supabase
      .from("scans")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", scan.id);

    return {
      scanId: scan.id,
      targetId,
      status: "failed",
      events: [],
      error: message,
    };
  }
}

// ─── Core: Scan Followers (single target) ─────────────────

export async function scanFollowers(targetId: string): Promise<ScanResult> {
  const supabase = createServerClient();
  const provider = getInstagramProvider();

  const { data: target } = await supabase
    .from("instagram_targets")
    .select("*")
    .eq("id", targetId)
    .single();

  if (!target) {
    return {
      scanId: "",
      targetId,
      status: "failed",
      events: [],
      error: "Target not found",
    };
  }

  const { data: scan } = await supabase
    .from("scans")
    .insert({
      target_id: targetId,
      status: "running",
      started_at: new Date().toISOString(),
      provider: provider.name,
      api_cost: 0,
      target_count: 1,
      profiles_returned: 0,
      suspect: false,
    })
    .select("id")
    .single();

  if (!scan) {
    return {
      scanId: "",
      targetId,
      status: "failed",
      events: [],
      error: "Failed to create scan record",
    };
  }

  try {
    const result = await provider.batchScan({
      usernames: [target.username],
      dataToScrape: "Followers",
      maxResultsPerUser: 0,
    });

    if (!result.success) {
      throw new Error(
        result.runMetadata.error || "Apify followers scan failed"
      );
    }

    const entries = result.entries.get(target.username.toLowerCase()) || [];

    await supabase
      .from("scans")
      .update({
        profiles_returned: result.totalProfilesReturned,
        actor_id: result.runMetadata.actorId || null,
        run_id: result.runMetadata.runId || null,
        api_cost: result.runMetadata.costEstimate || 0,
      })
      .eq("id", scan.id);

    const prevSnapshot = await getLatestValidSnapshot(
      supabase,
      targetId,
      "followers"
    );
    const isBaseline = !prevSnapshot;
    let events: FollowEvent[] = [];

    if (!isBaseline) {
      const prevMap = new Map<string, InstagramUserEntry>();
      for (let i = 0; i < prevSnapshot.account_ids.length; i++) {
        prevMap.set(prevSnapshot.account_ids[i], {
          userId: prevSnapshot.account_ids[i],
          username: prevSnapshot.account_usernames[i] || "",
          fullName: null,
          avatarUrl: null,
          isPrivate: false,
          isVerified: false,
        });
      }

      const currentMap = buildUserMap(entries);
      events = diffLists(prevMap, currentMap, "NEW_FOLLOWER", "LOST_FOLLOWER");
    }

    const { data: newSnapshot } = await supabase
      .from("follow_snapshots")
      .insert({
        target_id: targetId,
        snapshot_type: "followers",
        account_ids: buildUserIdList(entries),
        account_usernames: buildUsernameList(entries),
        scan_id: scan.id,
      })
      .select("id")
      .single();

    if (!isBaseline && events.length > 0 && newSnapshot) {
      const eventRows = events.map((e) => ({
        target_id: targetId,
        event_type: e.eventType,
        instagram_id: e.instagramId,
        username: e.username,
        full_name: e.fullName,
        avatar_url: e.avatarUrl,
        is_verified: e.isVerified,
        confirmed: false,
        previous_snapshot_id: prevSnapshot?.id || null,
        current_snapshot_id: newSnapshot.id,
      }));

      await supabase.from("follow_events").insert(eventRows);
    }

    await supabase
      .from("instagram_targets")
      .update({
        follower_count: entries.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId);

    await supabase
      .from("scans")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", scan.id);

    return { scanId: scan.id, targetId, status: "completed", events };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await supabase
      .from("scans")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", scan.id);

    return {
      scanId: scan.id,
      targetId,
      status: "failed",
      events: [],
      error: message,
    };
  }
}

// ─── Scheduler: Process Due Targets ───────────────────────

export async function processDueScans(): Promise<{
  scanned: number;
  failed: number;
  suspect: number;
  results: ScanResult[];
}> {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { data: dueTargets } = await supabase
    .from("instagram_targets")
    .select("id, username")
    .eq("monitoring_enabled", true)
    .lte("next_scan_at", now)
    .order("next_scan_at", { ascending: true })
    .limit(50);

  if (!dueTargets || dueTargets.length === 0) {
    return { scanned: 0, failed: 0, suspect: 0, results: [] };
  }

  const results: ScanResult[] = [];
  let scanned = 0;
  let failed = 0;
  let suspect = 0;

  for (let i = 0; i < dueTargets.length; i += BATCH_SIZE) {
    const batch = dueTargets.slice(i, i + BATCH_SIZE);

    for (const target of batch) {
      const result = await scanFollowing(target.id);
      results.push(result);

      if (result.status === "completed") {
        scanned++;
        const { data: t } = await supabase
          .from("instagram_targets")
          .select("follower_count")
          .eq("id", target.id)
          .single();

        if (t && t.follower_count <= 2500) {
          await scanFollowers(target.id);
        }
      } else if (result.status === "suspect") {
        suspect++;
      } else {
        failed++;
      }
    }
  }

  return { scanned, failed, suspect, results };
}

// ─── Initial Scan (new user search) ───────────────────────

/**
 * Performs the initial BASELINE scan for a new username.
 * Fetches following list once and stores it as the baseline snapshot.
 * No follow events are generated (baseline = no change history yet).
 */
export async function initialScan(username: string): Promise<{
  target: {
    id: string;
    instagram_id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    is_private: boolean;
    is_verified: boolean;
    following_count: number;
    follower_count: number;
  };
  following: InstagramUserEntry[];
  scanId: string;
}> {
  const provider = getInstagramProvider();
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();

  const result = await provider.batchScan({
    usernames: [cleanUsername],
    dataToScrape: "Followings",
    maxResultsPerUser: 0,
  });

  if (!result.success) {
    throw new Error(result.runMetadata.error || "Failed to scan account");
  }

  const entries = result.entries.get(cleanUsername) || [];

  if (entries.length === 0) {
    throw new Error(
      "Account not found or has no following data. Make sure it's a public account."
    );
  }

  const firstEntry = entries[0];
  const instagramId = `ig_${cleanUsername}`;

  const target = await upsertInstagramTarget({
    userId: instagramId,
    username: cleanUsername,
    fullName: firstEntry.fullName,
    avatarUrl: firstEntry.avatarUrl,
    isPrivate: firstEntry.isPrivate,
    isVerified: firstEntry.isVerified,
    followerCount: 0,
    followingCount: entries.length,
  });

  if (!target) {
    throw new Error("Failed to create target record");
  }

  // Store the baseline snapshot directly — no need for a second Apify call.
  // We already have the entries from the batchScan above.
  const scanId = await storeBaselineSnapshot(target.id, entries, provider.name);

  return {
    target: {
      ...target,
      following_count: entries.length,
      follower_count: 0,
    },
    following: entries,
    scanId: scanId,
  };
}

// ─── Query: Get Events ────────────────────────────────────

export async function getEventsForTarget(
  targetId: string,
  options: {
    limit?: number;
    confirmedOnly?: boolean;
    eventTypes?: FollowEvent["eventType"][];
  } = {}
) {
  const supabase = createServerClient();
  const { limit = 50, confirmedOnly = true, eventTypes } = options;

  let query = supabase
    .from("follow_events")
    .select("*")
    .eq("target_id", targetId)
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (confirmedOnly) {
    query = query.eq("confirmed", true);
  }

  if (eventTypes && eventTypes.length > 0) {
    query = query.in("event_type", eventTypes);
  }

  const { data } = await query;
  return data || [];
}

// ─── Query: Get Latest Snapshot ───────────────────────────

export async function getLatestSnapshot(
  targetId: string,
  type: "following" | "followers" = "following"
) {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("follow_snapshots")
    .select("*")
    .eq("target_id", targetId)
    .eq("snapshot_type", type)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

// ─── Enable / Disable Monitoring ──────────────────────────

export async function enableMonitoring(
  targetId: string,
  intervalHours: number = 24
): Promise<void> {
  const supabase = createServerClient();

  await supabase
    .from("instagram_targets")
    .update({
      monitoring_enabled: true,
      monitoring_interval_hours: intervalHours,
      scan_interval_hours: intervalHours,
      next_scan_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetId);
}

export async function disableMonitoring(targetId: string): Promise<void> {
  const supabase = createServerClient();

  await supabase
    .from("instagram_targets")
    .update({
      monitoring_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetId);
}
