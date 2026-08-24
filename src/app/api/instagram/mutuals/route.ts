import { NextResponse } from "next/server";
import {
  getAuthUser,
  hasActiveSubscription,
  ownsTarget,
} from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getMonitoringProvider } from "@/lib/instagram/provider";
import { getRemainingCredits, consumeCredit } from "@/lib/purchases";
import { extractInstagramUsername } from "@/lib/instagram/normalize";

/**
 * POST /api/instagram/mutuals
 * Body: { targetId, username }
 *
 * Computes the overlap between the tracked account's following list and another
 * public account's following list. One-time add-on (consumes a credit) because
 * it requires a fresh scrape of the second account.
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
    const rawUsername = typeof body.username === "string" ? body.username : "";
    const otherUsername = extractInstagramUsername(rawUsername);

    if (!targetId || !otherUsername) {
      return NextResponse.json(
        { error: "targetId and username are required" },
        { status: 400 }
      );
    }
    if (!(await ownsTarget(user.id, targetId, user.email))) {
      return NextResponse.json(
        { error: "You're not tracking this account" },
        { status: 403 }
      );
    }

    // Gate on credit BEFORE the paid scrape.
    if ((await getRemainingCredits(user.id, "mutuals")) <= 0) {
      return NextResponse.json(
        {
          error: "Mutual follows is a one-time add-on. Please purchase it to continue.",
          needsPurchase: true,
        },
        { status: 402 }
      );
    }

    const supabase = createServerClient();

    const { data: target } = await supabase
      .from("instagram_targets")
      .select("username")
      .eq("id", targetId)
      .single();
    if (!target) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    // Latest following snapshot of the tracked account (already stored).
    const { data: snapshot } = await supabase
      .from("follow_snapshots")
      .select("account_ids")
      .eq("target_id", targetId)
      .eq("snapshot_type", "following")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!snapshot || snapshot.account_ids.length === 0) {
      return NextResponse.json(
        { error: "No following data yet for this account" },
        { status: 404 }
      );
    }

    // Scrape the second account's following list (the marginal cost).
    const provider = getMonitoringProvider();
    const scan = await provider.batchScan({
      usernames: [otherUsername],
      dataToScrape: "Followings",
      maxResultsPerUser: 0,
    });
    if (!scan.success) {
      return NextResponse.json(
        { error: scan.runMetadata.error || "Failed to scan the other account" },
        { status: 502 }
      );
    }
    const otherEntries = scan.entries.get(otherUsername) || [];

    const targetIds = new Set(snapshot.account_ids);
    const mutuals = otherEntries.filter((e) => targetIds.has(e.userId));

    const ok = await consumeCredit(user.id, "mutuals");
    if (!ok) {
      return NextResponse.json(
        {
          error: "Mutual follows is a one-time add-on. Please purchase it to continue.",
          needsPurchase: true,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      targetUsername: target.username,
      otherUsername,
      mutualCount: mutuals.length,
      mutuals: mutuals.map((m) => ({
        userId: m.userId,
        username: m.username,
        fullName: m.fullName,
        avatarUrl: m.avatarUrl,
        isVerified: m.isVerified,
      })),
    });
  } catch (error) {
    console.error("Mutuals error:", error);
    return NextResponse.json({ error: "Mutual follows failed" }, { status: 500 });
  }
}
