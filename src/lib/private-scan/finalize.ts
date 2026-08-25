import { createServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { StoredPage } from "./page-store";
import type { ScanMember } from "./contracts";
import type { PrivateScanErrorCode } from "./errors";
import { getPagesForList, hasTerminalPage } from "./page-store";
import { validateCompleteList } from "./validator";
import { diffSnapshots } from "./diff";

/**
 * Finalization engine (§10, §13 of the plan).
 *
 * Called when the Shortcut signals it has finished uploading all pages
 * for a list type. This:
 *   1. Loads all staged pages
 *   2. Validates completeness (cursor chain, terminal, integrity)
 *   3. Aggregates & deduplicates members
 *   4. Computes the set hash
 *   5. Loads the previous snapshot (if any)
 *   6. Diffs and produces events
 *   7. Upserts the new snapshot
 *   8. Inserts events
 */

export interface FinalizeListResult {
  success: boolean;
  errorCode?: PrivateScanErrorCode;
  errorDetail?: string;
  /** Number of unique members in this list */
  memberCount: number;
  /** UUID of the created/updated snapshot */
  snapshotId?: string;
  /** True if there was no previous snapshot (this is the baseline) */
  isBaseline: boolean;
  /** Number of NEW events generated */
  newEventCount: number;
  /** Number of LOST/STOPPED events generated */
  lostEventCount: number;
}

export async function finalizeList(
  jobId: string,
  userId: string,
  targetId: string,
  listType: "followers" | "following"
): Promise<FinalizeListResult> {
  const supabase = createServerClient();

  // 1. Load all staged pages
  const pages = await getPagesForList(jobId, listType);

  // 2. Validate completeness
  const validation = validateCompleteList(pages);
  if (!validation.valid) {
    return {
      success: false,
      errorCode: validation.errorCode,
      errorDetail: validation.errorDetail,
      memberCount: 0,
      isBaseline: false,
      newEventCount: 0,
      lostEventCount: 0,
    };
  }

  // 3. Aggregate & deduplicate members (keep first seen)
  const seen = new Map<string, ScanMember>();
  for (const page of pages) {
    for (const member of page.members) {
      if (!seen.has(member.instagramId)) {
        seen.set(member.instagramId, member);
      }
    }
  }
  const members = Array.from(seen.values());
  const accountIds = members.map((m) => m.instagramId);
  const accountUsernames = members.map((m) => m.username);

  // 4. Look up the previous snapshot for this user/target/listType
  const { data: prevSnapshot } = await supabase
    .from("private_follow_snapshots")
    .select("id, account_ids, account_usernames")
    .eq("user_id", userId)
    .eq("target_id", targetId)
    .eq("snapshot_type", listType)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isBaseline = !prevSnapshot;

  // 5. Diff
  const prevMembers = prevSnapshot
    ? prevSnapshot.account_ids.map((id, i) => ({
        instagramId: id,
        username: prevSnapshot.account_usernames[i] || "unknown",
        fullName: null as string | null,
        isVerified: false,
        avatarUrl: null as string | null,
      }))
    : [];

  const diff = diffSnapshots(
    prevMembers,
    members,
    listType,
    "pending", // will be overwritten after insert
    prevSnapshot?.id ?? null
  );

  // 6. Upsert the new snapshot (unique on user_id, target_id, snapshot_type)
  const manifest = {
    jobId,
    pagesReceived: pages.length,
    rawMembers: pages.reduce((s, p) => s + p.rawCount, 0),
    uniqueMembers: members.length,
    terminalSeen: true,
    validationVersion: "1.0",
  };

  const { data: snapshot, error: snapshotError } = await supabase
    .from("private_follow_snapshots")
    .upsert(
      {
        user_id: userId,
        target_id: targetId,
        job_id: jobId,
        snapshot_type: listType,
        account_ids: accountIds,
        account_usernames: accountUsernames,
        set_hash: diff.setHash,
        manifest: manifest as unknown as Json,
        captured_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id, target_id, snapshot_type",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (snapshotError || !snapshot) {
    console.error("Failed to upsert private snapshot:", snapshotError);
    return {
      success: false,
      errorCode: "SERVER_VALIDATION_FAILED",
      errorDetail: "Failed to save snapshot",
      memberCount: members.length,
      isBaseline,
      newEventCount: 0,
      lostEventCount: 0,
    };
  }

  // 7. Insert diff events (when not baseline)
  let newEventCount = 0;
  let lostEventCount = 0;

  if (!isBaseline && (diff.added.length > 0 || diff.removed.length > 0)) {
    const eventRows = [
      ...diff.added.map((e) => ({
        user_id: userId,
        target_id: targetId,
        event_type: e.eventType,
        instagram_id: e.instagramId,
        username: e.username,
        full_name: e.fullName,
        avatar_url: e.avatarUrl,
        is_verified: e.isVerified,
        confirmed: true, // private scans are single-observer: confirmed immediately
        previous_snapshot_id:
          prevSnapshot?.id ??
          (null as unknown as undefined),
        current_snapshot_id: snapshot.id,
        detected_at: new Date().toISOString(),
      })),
      ...diff.removed.map((e) => ({
        user_id: userId,
        target_id: targetId,
        event_type: e.eventType,
        instagram_id: e.instagramId,
        username: e.username,
        full_name: e.fullName,
        avatar_url: e.avatarUrl,
        is_verified: e.isVerified,
        confirmed: true,
        previous_snapshot_id:
          prevSnapshot?.id ??
          (null as unknown as undefined),
        current_snapshot_id: snapshot.id,
        detected_at: new Date().toISOString(),
      })),
    ];

    const { error: eventError } = await supabase
      .from("private_follow_events")
      .insert(eventRows);

    if (eventError) {
      console.error("Failed to insert private follow events:", eventError);
    } else {
      newEventCount = diff.added.length;
      lostEventCount = diff.removed.length;
    }
  }

  return {
    success: true,
    memberCount: members.length,
    snapshotId: snapshot.id,
    isBaseline,
    newEventCount,
    lostEventCount,
  };
}