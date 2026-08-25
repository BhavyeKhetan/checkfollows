import { NextResponse } from "next/server";
import { getAuthUser, hasActiveSubscription, ownsTarget } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import { signScanToken } from "@/lib/private-scan/token";
import { canStartScan } from "@/lib/private-scan/rate-policy";
import { assertPrivateScanEnabled } from "@/lib/private-scan/feature-flag";
import type { StartScanRequest, StartScanResponse } from "@/lib/private-scan/contracts";

/**
 * POST /api/private-scan/start
 *
 * Creates a short-lived private scan job and returns a job-scoped token
 * the Shortcut uses to upload paginated follower/following data.
 * Authenticated via the normal CheckFollows web session cookie.
 */
export async function POST(request: Request) {
  try {
    // ─── Kill switch ───────────────────────────────────
    assertPrivateScanEnabled();

    // ─── Auth ──────────────────────────────────────────
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasActiveSubscription(user.id))) {
      return NextResponse.json(
        { error: "An active subscription is required" },
        { status: 402 }
      );
    }

    // ─── Parse body ────────────────────────────────────
    const body: StartScanRequest = await request.json().catch(() => ({}));
    const targetId = typeof body.targetId === "string" ? body.targetId : "";
    const requestedLists: ("followers" | "following")[] =
      Array.isArray(body.requestedLists) && body.requestedLists.length > 0
        ? body.requestedLists.filter(
            (l): l is "followers" | "following" =>
              l === "followers" || l === "following"
          )
        : ["followers", "following"];

    if (!targetId) {
      return NextResponse.json(
        { error: "targetId is required" },
        { status: 400 }
      );
    }

    // ─── Verify ownership ──────────────────────────────
    if (!(await ownsTarget(user.id, targetId, user.email))) {
      return NextResponse.json(
        { error: "You're not tracking this account" },
        { status: 403 }
      );
    }

    // ─── Load target ───────────────────────────────────
    const supabase = createServerClient();
    const { data: target } = await supabase
      .from("instagram_targets")
      .select("id, instagram_id, username, is_private")
      .eq("id", targetId)
      .single();

    if (!target) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!target.is_private) {
      return NextResponse.json(
        { error: "This account is public. Use standard monitoring instead." },
        { status: 400 }
      );
    }

    // ─── Rate-limit check ──────────────────────────────
    const rateCheck = await canStartScan(user.id, targetId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.message, errorCode: rateCheck.errorCode },
        { status: 429 }
      );
    }

    // ─── Create job ────────────────────────────────────
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min TTL
    const { data: job, error: jobError } = await supabase
      .from("private_scan_jobs")
      .insert({
        user_id: user.id,
        target_id: targetId,
        status: "open",
        requested_lists: requestedLists,
        expires_at: expiresAt.toISOString(),
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !job) {
      console.error("Failed to create private scan job:", jobError);
      return NextResponse.json(
        { error: "Failed to create scan job" },
        { status: 500 }
      );
    }

    // ─── Sign token ────────────────────────────────────
    const scanToken = signScanToken({
      j: job.id,
      u: user.id,
      t: targetId,
      l: requestedLists,
    });

    // ─── Response ──────────────────────────────────────
    const response: StartScanResponse = {
      jobId: job.id,
      scanToken,
      targetUsername: target.username,
      targetInstagramId: target.instagram_id,
      expiresAt: expiresAt.toISOString(),
      instagramUrl: `https://www.instagram.com/${target.username}/`,
      requestedLists,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Private scan start error:", error);
    return NextResponse.json(
      { error: "Failed to start scan" },
      { status: 500 }
    );
  }
}