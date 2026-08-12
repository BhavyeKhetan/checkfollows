/**
 * Monitoring Engine — Snapshot + diff engine + scheduler for CheckFollows.
 *
 * Architecture:
 *   1. Scan a target → fetch current Following list via HikerAPI
 *   2. Compare against the most recent snapshot in Supabase
 *   3. Generate follow_events for any detected changes
 *   4. Store the new snapshot for future comparisons
 *   5. Schedule the next scan
 *
 * Noise protection:
 *   Events are marked confirmed=false on first detection.
 *   They become confirmed=true only when observed in two consecutive scans.
 *   This avoids false positives from Instagram's slightly inconsistent lists.
 */

import { createServerClient } from "@/lib/supabase/server";
import {
  fetchProfileByUsername,
  fetchFollowing,
  fetchFollowers,
} from "@/lib/hikerapi";
import type { HikerProfile, HikerUserEntry } from "@/lib/hikerapi";

// ─── Types ───────────────────────────────────────────────

export interface ScanResult {
  scanId: string;
  targetId: string;
  status: "completed" | "failed";
  events: FollowEvent[];
  error?: string;
}

export interface FollowEvent {
  eventType: "NEW_FOLLOWING" | "STOPPED_FOLLOWING" | "NEW_FOLLOWER" | "LOST_FOLLOWER";
  instagramId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  confirmed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────

function buildUserMap(users: HikerUserEntry[]): Map<string, HikerUserEntry> {
  const map = new Map<string, HikerUserEntry>();
  for (const u of users) {
    map.set(u.pk, u);
  }
  return map;
}

function diffLists(
  previous: Map<string, HikerUserEntry>,
  current: Map<string, HikerUserEntry>,
  addEventType: FollowEvent["eventType"],
  removeEventType: FollowEvent["eventType"]
): FollowEvent[] {
  const events: FollowEvent[] = [];

  // New: in current but not in previous
  for (const [id, entry] of current) {
    if (!previous.has(id)) {
      events.push({
        eventType: addEventType,
        instagramId: id,
        username: entry.username,
        fullName: entry.full_name,
        avatarUrl: entry.profile_pic_url,
        isVerified: entry.is_verified,
        confirmed: false,
      });
    }
  }

  // Lost: in previous but not in current
  for (const [id, entry] of previous) {
    if (!current.has(id)) {
      events.push({
        eventType: removeEventType,
        instagramId: id,
        username: entry.username,
        fullName: entry.full_name,
        avatarUrl: entry.profile_pic_url,
        isVerified: entry.is_verified,
        confirmed: false,
      });
    }
  }

  return events;
}

function buildUserIdList(users: HikerUserEntry[]): string[] {
  return users.map((u) => u.pk);
}

function buildUsernameList(users: HikerUserEntry[]): string[] {
  return users.map((u) => u.username);
}

// ─── Core: Upsert Target ──────────────────────────────────

export async function upsertInstagramTarget(profile: HikerProfile) {
  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("instagram_targets")
    .select("id, next_scan_at")
    .eq("instagram_id", profile.pk)
    .maybeSingle();

  if (existing) {
    // Update profile info
    const { data } = await supabase
      .from("instagram_targets")
      .update({
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.profile_pic_url,
        is_private: profile.is_private,
        is_verified: profile.is_verified,
        following_count: profile.following_count,
        follower_count: profile.follower_count,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, instagram_id, username, full_name, avatar_url, is_private, is_verified")
      .single();

    return data;
  }

  // Insert new target
  const { data } = await supabase
    .from("instagram_targets")
    .insert({
      instagram_id: profile.pk,
      username: profile.username,
      full_name: profile.full_name,
      avatar_url: profile.profile_pic_url,
      is_private: profile.is_private,
      is_verified: profile.is_verified,
      following_count: profile.following_count,
      follower_count: profile.follower_count,
      scan_interval_hours: 24,
      next_scan_at: new Date().toISOString(), // eligible immediately
    })
    .select("id, instagram_id, username, full_name, avatar_url, is_private, is_verified")
    .single();

  return data;
}

// ─── Core: Scan Following ─────────────────────────────────

export async function scanFollowing(targetId: string): Promise<ScanResult> {
  const supabase = createServerClient();

  // Get target info
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

  // Create scan record
  const { data: scan } = await supabase
    .from("scans")
    .insert({
      target_id: targetId,
      status: "running",
      started_at: new Date().toISOString(),
      provider: "hikerapi",
      api_cost: 0,
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
    // Fetch current following list
    const currentFollowing = await fetchFollowing(target.instagram_id);

    // Get most recent snapshot
    const { data: prevSnapshot } = await supabase
      .from("follow_snapshots")
      .select("*")
      .eq("target_id", targetId)
      .eq("snapshot_type", "following")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build maps and diff
    const currentMap = buildUserMap(currentFollowing);
    let events: FollowEvent[] = [];

    if (prevSnapshot) {
      // Rebuild previous map from stored arrays
      const prevMap = new Map<string, HikerUserEntry>();
      for (let i = 0; i < prevSnapshot.account_ids.length; i++) {
        prevMap.set(prevSnapshot.account_ids[i], {
          pk: prevSnapshot.account_ids[i],
          username: prevSnapshot.account_usernames[i] || "",
          full_name: "",
          is_private: false,
          is_verified: false,
          profile_pic_url: "",
        });
      }

      events = diffLists(prevMap, currentMap, "NEW_FOLLOWING", "STOPPED_FOLLOWING");
    }

    // Store new snapshot
    const { data: newSnapshot } = await supabase
      .from("follow_snapshots")
      .insert({
        target_id: targetId,
        snapshot_type: "following",
        account_ids: buildUserIdList(currentFollowing),
        account_usernames: buildUsernameList(currentFollowing),
        scan_id: scan.id,
      })
      .select("id")
      .single();

    // Store events
    if (events.length > 0 && newSnapshot) {
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

    // Confirm events that were detected in the previous scan (noise protection)
    if (prevSnapshot) {
      const { data: unconfirmedEvents } = await supabase
        .from("follow_events")
        .select("id, instagram_id, event_type")
        .eq("target_id", targetId)
        .eq("confirmed", false)
        .eq("previous_snapshot_id", prevSnapshot.id);

      if (unconfirmedEvents && unconfirmedEvents.length > 0) {
        const currentIds = new Set(currentFollowing.map((u) => u.pk));

        for (const evt of unconfirmedEvents) {
          // For NEW_FOLLOWING: the account should still be in current following
          // For STOPPED_FOLLOWING: the account should still be absent
          let shouldConfirm = false;
          if (evt.event_type === "NEW_FOLLOWING" && currentIds.has(evt.instagram_id)) {
            shouldConfirm = true;
          } else if (evt.event_type === "STOPPED_FOLLOWING" && !currentIds.has(evt.instagram_id)) {
            shouldConfirm = true;
          }

          if (shouldConfirm) {
            await supabase
              .from("follow_events")
              .update({ confirmed: true })
              .eq("id", evt.id);
          }
        }
      }
    }

    // Schedule next scan
    const nextScanAt = new Date(
      Date.now() + target.scan_interval_hours * 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("instagram_targets")
      .update({
        last_scanned_at: new Date().toISOString(),
        next_scan_at: nextScanAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId);

    // Mark scan as complete
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

// ─── Core: Scan Followers ─────────────────────────────────

export async function scanFollowers(targetId: string): Promise<ScanResult> {
  const supabase = createServerClient();

  const { data: target } = await supabase
    .from("instagram_targets")
    .select("*")
    .eq("id", targetId)
    .single();

  if (!target) {
    return { scanId: "", targetId, status: "failed", events: [], error: "Target not found" };
  }

  const { data: scan } = await supabase
    .from("scans")
    .insert({
      target_id: targetId,
      status: "running",
      started_at: new Date().toISOString(),
      provider: "hikerapi",
      api_cost: 0,
    })
    .select("id")
    .single();

  if (!scan) {
    return { scanId: "", targetId, status: "failed", events: [], error: "Failed to create scan record" };
  }

  try {
    const currentFollowers = await fetchFollowers(target.instagram_id);

    const { data: prevSnapshot } = await supabase
      .from("follow_snapshots")
      .select("*")
      .eq("target_id", targetId)
      .eq("snapshot_type", "followers")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentMap = buildUserMap(currentFollowers);
    let events: FollowEvent[] = [];

    if (prevSnapshot) {
      const prevMap = new Map<string, HikerUserEntry>();
      for (let i = 0; i < prevSnapshot.account_ids.length; i++) {
        prevMap.set(prevSnapshot.account_ids[i], {
          pk: prevSnapshot.account_ids[i],
          username: prevSnapshot.account_usernames[i] || "",
          full_name: "",
          is_private: false,
          is_verified: false,
          profile_pic_url: "",
        });
      }

      events = diffLists(prevMap, currentMap, "NEW_FOLLOWER", "LOST_FOLLOWER");
    }

    const { data: newSnapshot } = await supabase
      .from("follow_snapshots")
      .insert({
        target_id: targetId,
        snapshot_type: "followers",
        account_ids: buildUserIdList(currentFollowers),
        account_usernames: buildUsernameList(currentFollowers),
        scan_id: scan.id,
      })
      .select("id")
      .single();

    if (events.length > 0 && newSnapshot) {
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
      .from("scans")
      .update({ status: "completed", completed_at: new Date().toISOString() })
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

    return { scanId: scan.id, targetId, status: "failed", events: [], error: message };
  }
}

// ─── Scheduler: Process Due Targets ───────────────────────

export async function processDueScans(): Promise<{
  scanned: number;
  failed: number;
  results: ScanResult[];
}> {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  // Find targets due for scanning (next_scan_at <= now)
  const { data: dueTargets } = await supabase
    .from("instagram_targets")
    .select("id")
    .lte("next_scan_at", now)
    .limit(50); // process at most 50 per cron run

  if (!dueTargets || dueTargets.length === 0) {
    return { scanned: 0, failed: 0, results: [] };
  }

  const results: ScanResult[] = [];
  let scanned = 0;
  let failed = 0;

  for (const target of dueTargets) {
    const result = await scanFollowing(target.id);
    results.push(result);

    if (result.status === "completed") {
      scanned++;
      // Optionally also scan followers for lightweight accounts
      const { data: t } = await supabase
        .from("instagram_targets")
        .select("follower_count")
        .eq("id", target.id)
        .single();

      if (t && t.follower_count <= 2500) {
        await scanFollowers(target.id);
      }
    } else {
      failed++;
    }
  }

  return { scanned, failed, results };
}

// ─── First Scan (for new search) ──────────────────────────

export async function initialScan(
  username: string
): Promise<{
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
  following: HikerUserEntry[];
  scanId: string;
}> {
  const profile = await fetchProfileByUsername(username);

  if (profile.is_private) {
    throw new Error("This account is private. CheckFollows only works with public accounts.");
  }

  // Upsert the target
  const target = await upsertInstagramTarget(profile);
  if (!target) {
    throw new Error("Failed to create target record");
  }

  // Perform first scan
  const scanResult = await scanFollowing(target.id);

  // Fetch the full following list for display
  const following = await fetchFollowing(profile.pk);

  return {
    target: {
      ...target,
      following_count: profile.following_count,
      follower_count: profile.follower_count,
    },
    following,
    scanId: scanResult.scanId,
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
