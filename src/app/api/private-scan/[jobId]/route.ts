import { NextResponse } from "next/server";
import { getAuthUser, ownsTarget } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { JobStatusResponse, PrivateScanResult } from "@/lib/private-scan/contracts";

/**
 * GET /api/private-scan/[jobId]
 *
 * Poll a private scan job's current status. Used by the track page to show
 * live progress after a user starts a scan from their iPhone.
 * Auth: normal CheckFollows web session cookie.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;

    // ─── Auth ──────────────────────────────────────────
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: job, error } = await supabase
      .from("private_scan_jobs")
      .select(
        "id, user_id, target_id, status, requested_lists, started_at, completed_at, expires_at, error_code, error_detail_safe"
      )
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Load target username
    const { data: target } = await supabase
      .from("instagram_targets")
      .select("username")
      .eq("id", job.target_id)
      .single();

    // Count events if completed
    let hasEvents = false;
    let eventCount = 0;
    if (job.status === "completed") {
      const { count } = await supabase
        .from("private_follow_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("target_id", job.target_id);
      eventCount = count ?? 0;
      hasEvents = eventCount > 0;
    }

    const response: JobStatusResponse = {
      id: job.id,
      status: job.status as JobStatusResponse["status"],
      targetId: job.target_id,
      targetUsername: target?.username || "unknown",
      requestedLists: job.requested_lists,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      expiresAt: job.expires_at,
      errorCode: job.error_code,
      errorDetailSafe: job.error_detail_safe,
      hasEvents,
      eventCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Private scan job status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}

/**
 * Fetch the private scan result summary for a user-target pair.
 * Used by the track page server component to check if private scan data exists.
 */
export async function getPrivateScanResult(
  userId: string,
  targetId: string
): Promise<PrivateScanResult> {
  const supabase = createServerClient();

  const [lastJob, followerSnapshot, followingSnapshot] = await Promise.all([
    supabase
      .from("private_scan_jobs")
      .select("id, status, completed_at, started_at")
      .eq("user_id", userId)
      .eq("target_id", targetId)
      .in("status", ["completed", "failed"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("private_follow_snapshots")
      .select("account_ids")
      .eq("user_id", userId)
      .eq("target_id", targetId)
      .eq("snapshot_type", "followers")
      .maybeSingle(),
    supabase
      .from("private_follow_snapshots")
      .select("account_ids")
      .eq("user_id", userId)
      .eq("target_id", targetId)
      .eq("snapshot_type", "following")
      .maybeSingle(),
  ]);

  const hasBaseline = !!(followerSnapshot.data || followingSnapshot.data);

  return {
    lastScanAt: lastJob.data?.completed_at || lastJob.data?.started_at || null,
    lastScanJobId: lastJob.data?.id || null,
    lastScanStatus: lastJob.data
      ? (lastJob.data.status as "completed" | "failed")
      : null,
    hasBaseline,
    followerSnapshotMemberCount:
      followerSnapshot.data?.account_ids?.length ?? 0,
    followingSnapshotMemberCount:
      followingSnapshot.data?.account_ids?.length ?? 0,
  };
}