import { NextResponse } from "next/server";
import {
  getAuthUser,
  hasActiveSubscription,
  ownsTarget,
} from "@/lib/supabase/auth";
import { getTrackingTimeline } from "@/lib/tracking-data";
import { createServerClient } from "@/lib/supabase/server";
import {
  extractInstagramUsername,
  isValidInstagramUsername,
} from "@/lib/instagram/normalize";

export async function GET(request: Request) {
  // Paid data: require an authenticated user with an active subscription.
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const entitled = await hasActiveSubscription(user.id);
  if (!entitled) {
    return NextResponse.json(
      { success: false, error: "An active subscription is required" },
      { status: 402 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawUsername = searchParams.get("username");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const cleanUsername = extractInstagramUsername(rawUsername);

  if (!isValidInstagramUsername(cleanUsername)) {
    return NextResponse.json(
      { success: false, error: "A valid username is required" },
      { status: 400 }
    );
  }

  try {
    const timeline = await getTrackingTimeline(cleanUsername, limit);
    if (!timeline) {
      return NextResponse.json({ success: false, error: "Target not found" }, { status: 404 });
    }
    if (!(await ownsTarget(user.id, timeline.target.id, user.email))) {
      return NextResponse.json(
        { success: false, error: "Target not found" },
        { status: 404 }
      );
    }
    const { data: ownership } = await createServerClient()
      .from("subscriptions")
      .select("user_paused")
      .eq("user_id", user.id)
      .eq("target_id", timeline.target.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      target: {
        ...timeline.target,
        monitoring_enabled:
          timeline.target.monitoring_enabled && ownership?.user_paused !== true,
      },
      events: timeline.events,
    });
  } catch (error) {
    console.error("Events API error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
