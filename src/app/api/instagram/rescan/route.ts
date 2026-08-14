import { NextResponse } from "next/server";
import {
  getAuthUser,
  hasActiveSubscription,
  ownsTarget,
} from "@/lib/supabase/auth";
import { scanFollowing } from "@/lib/monitoring";
import { getRemainingCredits, consumeCredit } from "@/lib/purchases";

/**
 * POST /api/instagram/rescan
 * Body: { targetId }
 *
 * Runs an immediate scan of the tracked account, consuming a one-time rescan
 * credit. Requires an active subscription. The credit must exist before the
 * (paid) Apify scan is triggered.
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
    if (!targetId) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }
    if (!(await ownsTarget(user.id, targetId, user.email))) {
      return NextResponse.json(
        { error: "You're not tracking this account" },
        { status: 403 }
      );
    }

    // Consume the credit BEFORE the paid scan.
    if ((await getRemainingCredits(user.id, "rescan_credits")) <= 0) {
      return NextResponse.json(
        {
          error: "On-demand rescans are a paid add-on. Please purchase a rescan to continue.",
          needsPurchase: true,
        },
        { status: 402 }
      );
    }
    await consumeCredit(user.id, "rescan_credits");

    const result = await scanFollowing(targetId);

    return NextResponse.json({
      success: result.status === "completed",
      status: result.status,
      events: result.events,
      error: result.error,
    });
  } catch (error) {
    console.error("Rescan error:", error);
    return NextResponse.json({ error: "Rescan failed" }, { status: 500 });
  }
}
