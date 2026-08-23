import { NextResponse } from "next/server";
import {
  getAuthUser,
  hasActiveSubscription,
  ownsTarget,
} from "@/lib/supabase/auth";
import { scanFollowing } from "@/lib/monitoring";
import {
  availableCreditsForReason,
  completeScanCreditReservation,
  getScanCreditSummary,
  refundScanCreditReservation,
  reserveUserScanCredits,
  scanCreditsForFollowingCount,
} from "@/lib/scan-credits";

/**
 * POST /api/instagram/rescan
 * Body: { targetId }
 *
 * Runs an immediate full scan. The server calculates the account-size cost,
 * atomically reserves that many purchased rescan credits, and refunds the exact
 * reservation if the provider does not return a complete trusted snapshot.
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json().catch(() => ({}));
    const targetId = typeof body.targetId === "string" ? body.targetId : "";
    const requestId =
      typeof body.requestId === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(body.requestId)
        ? body.requestId
        : crypto.randomUUID();
    if (!targetId) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }
    if (!(await ownsTarget(user.id, targetId, user.email))) {
      return NextResponse.json(
        { error: "You're not tracking this account" },
        { status: 403 }
      );
    }

    // Check if the user has paused tracking for this account
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("user_paused")
      .eq("target_id", targetId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: targetRow } = await supabase
      .from("instagram_targets")
      .select("monitoring_enabled, following_count, follower_count")
      .eq("id", targetId)
      .maybeSingle();

    if (sub?.user_paused === true || targetRow?.monitoring_enabled === false) {
      return NextResponse.json(
        {
          error: "Tracking is paused for this account. Please resume tracking before rescanning.",
          isPaused: true,
        },
        { status: 400 }
      );
    }

    if (!targetRow) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const requiredCredits = scanCreditsForFollowingCount(
      targetRow.following_count
    );
    const quotedScanCredits = Number.isInteger(body.quotedScanCredits)
      ? body.quotedScanCredits
      : null;
    const credits = await getScanCreditSummary(user.id);
    const quote = {
      followingCount: targetRow.following_count,
      followerCount: targetRow.follower_count,
      requiredScanCredits: requiredCredits,
      credits,
      canAfford:
        !!credits &&
        availableCreditsForReason(credits, "manual") >= requiredCredits,
    };

    if (body.scanCreditsConfirmed !== true || quotedScanCredits !== requiredCredits) {
      return NextResponse.json(
        {
          error:
            quotedScanCredits !== null && quotedScanCredits !== requiredCredits
              ? "This account's following count changed. Review the updated scan cost."
              : "Confirm the scan credit cost before rescanning.",
          needsScanConfirmation: true,
          quote,
        },
        { status: 409 }
      );
    }

    const { data: runningScan } = await supabase
      .from("scans")
      .select("id")
      .eq("target_id", targetId)
      .eq("status", "running")
      .limit(1)
      .maybeSingle();
    if (runningScan) {
      return NextResponse.json(
        { error: "A complete scan is already running for this account." },
        { status: 409 }
      );
    }

    if (
      !credits ||
      availableCreditsForReason(credits, "manual") < requiredCredits
    ) {
      return NextResponse.json(
        {
          error: `This scan needs ${requiredCredits} scan credits. Add credits to continue.`,
          needsPurchase: true,
          quote,
        },
        { status: 402 }
      );
    }

    const reservation = await reserveUserScanCredits({
      userId: user.id,
      targetId,
      units: requiredCredits,
      reason: "manual",
      idempotencyKey: `manual:${user.id}:${requestId}`,
    });
    if (!reservation.reserved || !reservation.reservationId) {
      if (reservation.reservationId) {
        return NextResponse.json(
          { error: "This scan request is already running or was already processed." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: `This scan needs ${requiredCredits} scan credits. Add credits to continue.`,
          needsPurchase: true,
          quote: { ...quote, credits: await getScanCreditSummary(user.id) },
        },
        { status: 402 }
      );
    }

    let result;
    try {
      result = await scanFollowing(targetId);
      if (result.status === "completed") {
        await completeScanCreditReservation(
          reservation.reservationId,
          result.scanId
        );
      } else {
        await refundScanCreditReservation(
          reservation.reservationId,
          result.status === "suspect" ? "scan_incomplete" : "scan_failed"
        );
      }
    } catch (scanError) {
      await refundScanCreditReservation(
        reservation.reservationId,
        "scan_exception"
      );
      throw scanError;
    }

    const updatedCredits = await getScanCreditSummary(user.id);

    return NextResponse.json({
      success: result.status === "completed",
      status: result.status,
      events: result.events,
      error: result.error,
      chargedCredits: result.status === "completed" ? requiredCredits : 0,
      refundedCredits: result.status === "completed" ? 0 : requiredCredits,
      credits: updatedCredits,
    });
  } catch (error) {
    console.error("Rescan error:", error);
    return NextResponse.json({ error: "Rescan failed" }, { status: 500 });
  }
}
