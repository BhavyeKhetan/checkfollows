import { createServerClient } from "@/lib/supabase/server";
import type { PrivateScanErrorCode } from "./errors";

/**
 * Rate policy for private mobile scans (§12 of the plan).
 *
 * Conservative defaults until real-world behavior is measured:
 *   - One open job per user-target pair at a time
 *   - Minimum 1-hour cooldown between completed scans
 *   - Maximum 5 scans per user per day (across all targets)
 */

const COOLDOWN_HOURS = 1;
const MAX_DAILY_SCANS = 5;

const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

/** Check whether a user is allowed to create a new scan job. */
export async function canStartScan(
  userId: string,
  targetId: string
): Promise<
  | { allowed: true }
  | { allowed: false; errorCode: PrivateScanErrorCode; message: string }
> {
  const supabase = createServerClient();

  // 1. No open job for this user/target
  const { data: openJob } = await supabase
    .from("private_scan_jobs")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("target_id", targetId)
    .eq("status", "open")
    .maybeSingle();

  if (openJob) {
    return {
      allowed: false,
      errorCode: "CHECKFOLLOWS_JOB_ALREADY_FINALIZED",
      message:
        "You already have an active scan for this account. Complete or wait for it to expire before starting a new one.",
    };
  }

  // 2. Cooldown: check most recent completed scan for this user/target
  const { data: lastScan } = await supabase
    .from("private_scan_jobs")
    .select("completed_at, started_at")
    .eq("user_id", userId)
    .eq("target_id", targetId)
    .in("status", ["completed", "failed"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastScan) {
    const refTime = lastScan.completed_at || lastScan.started_at;
    const elapsed = Date.now() - new Date(refTime).getTime();
    if (elapsed < COOLDOWN_MS) {
      const waitMinutes = Math.ceil((COOLDOWN_MS - elapsed) / 60_000);
      return {
        allowed: false,
        errorCode: "CHECKFOLLOWS_JOB_ALREADY_FINALIZED",
        message: `Please wait about ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"} before scanning this account again.`,
      };
    }
  }

  // 3. Daily cap across all targets
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("private_scan_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("started_at", dayStart.toISOString())
    .in("status", ["open", "completed"]);

  if ((count ?? 0) >= MAX_DAILY_SCANS) {
    return {
      allowed: false,
      errorCode: "CHECKFOLLOWS_JOB_ALREADY_FINALIZED",
      message: `You've reached the daily limit of ${MAX_DAILY_SCANS} private scans. Please try again tomorrow.`,
    };
  }

  return { allowed: true };
}

/** Check if the Shortcut viewer identity has been throttled. */
export function isViewerThrottled(
  viewerInstagramId: string | null,
  viewerUsername: string | null
): boolean {
  // Stub: reserved for future Instagram safety throttling.
  // Today we trust the job-level cooldown alone.
  void viewerInstagramId;
  void viewerUsername;
  return false;
}