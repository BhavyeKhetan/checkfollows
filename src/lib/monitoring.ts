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
import {
  getMonitoringProvider,
  getPreviewProvider,
} from "@/lib/instagram/provider";
import type {
  InstagramUserEntry,
  InstagramProfile,
} from "@/lib/instagram/provider";

// ─── Config ───────────────────────────────────────────────

const SUSPECT_THRESHOLD = parseFloat(
  process.env.SUSPECT_THRESHOLD_PCT || "0.20"
);
const BATCH_SIZE = parseInt(process.env.MONITORING_BATCH_SIZE || "10", 10);

// Monitoring cadence: every other day (48h) instead of daily (24h).
const DEFAULT_INTERVAL_HOURS = parseInt(
  process.env.MONITORING_INTERVAL_HOURS || "48",
  10
);

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
  providerName: string,
  runMetadata?: {
    actorId?: string;
    runId?: string;
    costEstimate?: number;
  }
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
      api_cost: runMetadata?.costEstimate || 0,
      target_count: 1,
      profiles_returned: entries.length,
      actor_id: runMetadata?.actorId || null,
      run_id: runMetadata?.runId || null,
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
        Date.now() + DEFAULT_INTERVAL_HOURS * 60 * 60 * 1000
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
      scan_interval_hours: DEFAULT_INTERVAL_HOURS,
      monitoring_enabled: false,
    })
    .select(
      "id, instagram_id, username, full_name, avatar_url, is_private, is_verified, following_count, follower_count"
    )
    .single();

  return data;
}

// ─── Core Diff Logic (reusable for single + batch) ───────

async function processTargetDiff(
  target: { id: string; username: string; monitoring_interval_hours?: number },
  scan: { id: string },
  entries: InstagramUserEntry[]
): Promise<ScanResult> {
  const supabase = createServerClient();
  const targetId = target.id;
  const currentCount = entries.length;

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
    ).map((e) =>
      // New follows are accepted after one valid scan (additions are less
      // risky than removals). Mark them confirmed so alerts fire immediately.
      e.eventType === "NEW_FOLLOWING" ? { ...e, confirmed: true } : e
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
      confirmed: e.confirmed,
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
  const intervalHours = target.monitoring_interval_hours || DEFAULT_INTERVAL_HOURS;
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
}

// ─── Core: Scan Following (single target) ─────────────────

export async function scanFollowing(targetId: string): Promise<ScanResult> {
  const supabase = createServerClient();
  const provider = getMonitoringProvider();

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

    await supabase
      .from("scans")
      .update({
        profiles_returned: result.totalProfilesReturned,
        actor_id: result.runMetadata.actorId || null,
        run_id: result.runMetadata.runId || null,
        api_cost: result.runMetadata.costEstimate || 0,
      })
      .eq("id", scan.id);

    return processTargetDiff(target, scan, entries);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const failBackoffHours = Math.min(
      (target.scan_interval_hours || DEFAULT_INTERVAL_HOURS) * 2,
      24
    );
    const nextRetryAt = new Date(Date.now() + failBackoffHours * 60 * 60 * 1000).toISOString();

    await supabase
      .from("instagram_targets")
      .update({ next_scan_at: nextRetryAt, updated_at: new Date().toISOString() })
      .eq("id", targetId);

    await supabase
      .from("scans")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_message: message })
      .eq("id", scan.id);

    return { scanId: scan.id, targetId, status: "failed", events: [], error: message };
  }
}

// ─── Core: Scan Followers (single target) ─────────────────

export async function scanFollowers(targetId: string): Promise<ScanResult> {
  const supabase = createServerClient();
  const provider = getMonitoringProvider();

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
      events = diffLists(prevMap, currentMap, "NEW_FOLLOWER", "LOST_FOLLOWER").map(
        (e) => (e.eventType === "NEW_FOLLOWER" ? { ...e, confirmed: true } : e)
      );
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
        confirmed: e.confirmed,
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

// ─── Scheduler: Process Due Targets (TRUE BATCHING) ───────

export async function processDueScans(): Promise<{
  scanned: number;
  failed: number;
  suspect: number;
  results: ScanResult[];
}> {
  const supabase = createServerClient();
  const provider = getMonitoringProvider();
  const now = new Date().toISOString();

  // Get target IDs that have an active PAID subscription.
  // A paid subscription MUST have a Stripe subscription ID — this is the
  // entitlement gate that prevents free monitoring (legacy free rows have
  // no stripe_subscription_id and no longer unlock scans). Rows the user
  // explicitly paused (user_paused = true) are excluded.
  const { data: paidSubs } = await supabase
    .from("subscriptions")
    .select("target_id")
    .eq("active", true)
    .eq("user_paused", false)
    .not("stripe_subscription_id", "is", null);

  const paidTargetIds = new Set(
    (paidSubs || [])
      .map((s) => s.target_id)
      .filter((id): id is string => !!id)
  );

  const { data: dueTargets } = await supabase
    .from("instagram_targets")
    .select("id, username, monitoring_interval_hours")
    .eq("monitoring_enabled", true)
    .lte("next_scan_at", now)
    .order("next_scan_at", { ascending: true })
    .limit(50);

  // Only scan targets that have an active paid subscription
  const eligibleTargets = (dueTargets || []).filter((t) =>
    paidTargetIds.has(t.id)
  );

  const eligibleIds = eligibleTargets.map((t) => t.id);
  if (eligibleIds.length === 0) {
    return { scanned: 0, failed: 0, suspect: 0, results: [] };
  }

  // ─── Atomic claim (concurrency-safe) ─────────────────
  // The hourly Supabase scheduler AND the daily Vercel cron can overlap.
  // Reserve due targets by bumping next_scan_at forward in one atomic UPDATE.
  // A concurrent run that already claimed a row will no longer match
  // `next_scan_at <= now`, so it silently skips it — no double scans.
  const claimUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: claimedTargets } = await supabase
    .from("instagram_targets")
    .update({ next_scan_at: claimUntil })
    .in("id", eligibleIds)
    .lte("next_scan_at", now)
    .select("id, username, monitoring_interval_hours");

  const batchTargets = (claimedTargets || []).filter((t) =>
    paidTargetIds.has(t.id)
  );

  if (batchTargets.length === 0) {
    return { scanned: 0, failed: 0, suspect: 0, results: [] };
  }

  const results: ScanResult[] = [];
  let scanned = 0;
  let failed = 0;
  let suspect = 0;

  // ─── TRUE BATCHING: One Apify call per batch ─────────
  for (let i = 0; i < batchTargets.length; i += BATCH_SIZE) {
    const batch = batchTargets.slice(i, i + BATCH_SIZE);
    const batchUsernames = batch.map((t) => t.username);

    // Make ONE Apify call for all targets in this batch
    const batchResult = await provider.batchScan({
      usernames: batchUsernames,
      dataToScrape: "Followings",
      maxResultsPerUser: 0,
    });

    if (!batchResult.success) {
      // Entire batch failed — mark all as failed
      for (const target of batch) {
        const { data: failScan } = await supabase
          .from("scans")
          .insert({
            target_id: target.id,
            status: "failed",
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            provider: provider.name,
            error_message: batchResult.runMetadata.error || "Batch scan failed",
            api_cost: 0,
            target_count: batch.length,
            profiles_returned: 0,
            suspect: false,
          })
          .select("id")
          .maybeSingle();

        // Back off retries so a provider outage doesn't re-fire every scheduler run
        const failBackoffHours = Math.min(
          (target.monitoring_interval_hours || DEFAULT_INTERVAL_HOURS) * 2,
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
          .eq("id", target.id);

        results.push({
          scanId: failScan?.id || "",
          targetId: target.id,
          status: "failed",
          events: [],
          error: batchResult.runMetadata.error || "Batch scan failed",
        });
        failed++;
      }
      continue;
    }

    // Process each target in the batch with its own entries
    for (const target of batch) {
      const entries = batchResult.entries.get(target.username.toLowerCase()) || [];
      const allocatedCost = batchResult.totalProfilesReturned
        ? ((batchResult.runMetadata.costEstimate || 0) * entries.length) /
          batchResult.totalProfilesReturned
        : 0;

      // Create a scan record for this specific target
      const { data: scan } = await supabase
        .from("scans")
        .insert({
          target_id: target.id,
          status: "running",
          started_at: new Date().toISOString(),
          provider: provider.name,
          api_cost: allocatedCost,
          target_count: batch.length,
          profiles_returned: entries.length,
          actor_id: batchResult.runMetadata.actorId || null,
          run_id: batchResult.runMetadata.runId || null,
          suspect: false,
        })
        .select("id")
        .single();

      if (!scan) {
        results.push({ scanId: "", targetId: target.id, status: "failed", events: [], error: "Failed to create scan" });
        failed++;
        continue;
      }

      const result = await processTargetDiff(target, scan, entries);
      results.push(result);

      if (result.status === "completed") {
        scanned++;
        // Optionally scan followers for small accounts
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

// ─── Preview Lookup (unpaid landing-page search) ─────────

const PREVIEW_CAP = parseInt(process.env.PREVIEW_FOLLOW_CAP || "10", 10);

/**
 * Lightweight preview for unpaid landing-page searches.
 * Uses the cheap apify/instagram-profile-scraper ONLY for profile data.
 * Does NOT fetch following/followers lists (that happens after payment).
 * Does NOT store a baseline snapshot — that happens after payment.
 */
export async function previewLookup(username: string): Promise<{
  profile: InstagramProfile;
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
  } | null;
  followingPreview: InstagramUserEntry[];
  followersPreview: InstagramUserEntry[];
}> {
  const previewProvider = getPreviewProvider();
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();

  // Fetch profile using the cheap preview actor — profile data only, no follow lists
  const profile = await previewProvider.fetchProfile(cleanUsername);

  if (profile.isPrivate) {
    throw new Error("This account is private");
  }

  // Upsert target (or update existing) so we have a record
  const target = await upsertInstagramTarget(profile);

  // Follow/followers lists are NOT fetched here — they require the expensive
  // dead00 actor. The frontend can lazily fetch capped previews on-demand
  // via /api/instagram/follows?preview=true&username=...

  return {
    profile,
    target,
    followingPreview: [],
    followersPreview: [],
  };
}

// ─── Full Baseline Scan (after payment) ──────────────────

/**
 * Performs the full BASELINE scan for a paid user.
 * Fetches the COMPLETE following list and stores it as the baseline snapshot.
 * No follow events are generated (baseline = no change history yet).
 * Enables monitoring for daily re-scans.
 */
export async function fullBaselineScan(username: string): Promise<{
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
  const provider = getMonitoringProvider();
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

  // Get real Instagram ID from preview provider (cheap, ensures dedup)
  let realUserId = "";
  try {
    const previewProvider = getPreviewProvider();
    const profile = await previewProvider.fetchProfile(cleanUsername);
    realUserId = profile.userId;
  } catch {
    // Fallback: use the first following entry if preview fails
    // This only happens if the preview actor is down — dedup still works
    // for targets created via previewLookup first.
    realUserId = entries[0]?.userId || `ig_${cleanUsername}`;
  }

  const firstEntry = entries[0];
  const target = await upsertInstagramTarget({
    userId: realUserId,
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
  const scanId = await storeBaselineSnapshot(
    target.id,
    entries,
    provider.name,
    result.runMetadata
  );

  // Enable daily monitoring
  await enableMonitoring(target.id);

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
  intervalHours: number = DEFAULT_INTERVAL_HOURS
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

/** Keep a shared Instagram target running while any paid subscriber uses it. */
export async function disableMonitoringIfUnused(targetId: string): Promise<void> {
  const supabase = createServerClient();
  const { count } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("target_id", targetId)
    .eq("active", true)
    .eq("user_paused", false)
    .not("stripe_subscription_id", "is", null);

  if ((count || 0) === 0) await disableMonitoring(targetId);
}
