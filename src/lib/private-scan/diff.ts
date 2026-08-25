import { createHash } from "node:crypto";

/**
 * Pure-function snapshot diff engine (§10, §13 of the plan).
 *
 * Takes two sorted ID arrays and produces the events that should be recorded.
 * All identity is numeric Instagram user ID — username is metadata.
 */

export interface DiffMember {
  instagramId: string;
  username: string;
  fullName?: string | null;
  isVerified?: boolean;
  avatarUrl?: string | null;
}

export interface DiffEvent {
  eventType: "NEW_FOLLOWING" | "STOPPED_FOLLOWING" | "NEW_FOLLOWER" | "LOST_FOLLOWER";
  instagramId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}

export interface DiffResult {
  added: DiffEvent[];
  removed: DiffEvent[];
  addedCount: number;
  removedCount: number;
  previousCount: number;
  currentCount: number;
  /** SHA-256 of sorted current IDs (the set hash) */
  setHash: string;
}

/**
 * Compute the diff between two snapshots.
 *
 * @param previousMembers - Members from the most recent snapshot (empty array = baseline / no previous)
 * @param currentMembers - Members from the freshly collected list
 * @param snapshotType - "followers" or "following"
 * @param currentSnapshotId - UUID of the snapshot being created
 * @param previousSnapshotId - UUID of the previous snapshot (null for baseline)
 */
export function diffSnapshots(
  previousMembers: DiffMember[],
  currentMembers: DiffMember[],
  snapshotType: "followers" | "following",
  currentSnapshotId: string,
  previousSnapshotId: string | null
): DiffResult {
  // Build lookup maps keyed by Instagram ID
  const prev = new Map<string, DiffMember>(
    previousMembers.map((m) => [m.instagramId, m])
  );
  const curr = new Map<string, DiffMember>(
    currentMembers.map((m) => [m.instagramId, m])
  );

  const added: DiffEvent[] = [];
  const removed: DiffEvent[] = [];

  // Find additions: in current but not in previous
  for (const [id, member] of curr) {
    if (!prev.has(id)) {
      added.push({
        eventType:
          snapshotType === "following" ? "NEW_FOLLOWING" : "NEW_FOLLOWER",
        instagramId: id,
        username: member.username,
        fullName: member.fullName ?? null,
        avatarUrl: member.avatarUrl ?? null,
        isVerified: member.isVerified ?? false,
      });
    }
  }

  // Find removals: in previous but not in current
  for (const [id, member] of prev) {
    if (!curr.has(id)) {
      removed.push({
        eventType:
          snapshotType === "following"
            ? "STOPPED_FOLLOWING"
            : "LOST_FOLLOWER",
        instagramId: id,
        username: member.username,
        fullName: member.fullName ?? null,
        avatarUrl: member.avatarUrl ?? null,
        isVerified: member.isVerified ?? false,
      });
    }
  }

  // Compute set hash: SHA-256 of sorted current IDs
  const sortedIds = currentMembers
    .map((m) => m.instagramId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const setHash = createHash("sha256")
    .update(sortedIds.join(","))
    .digest("hex");

  return {
    added,
    removed,
    addedCount: added.length,
    removedCount: removed.length,
    previousCount: previousMembers.length,
    currentCount: currentMembers.length,
    setHash,
  };
}