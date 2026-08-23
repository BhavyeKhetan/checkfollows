import { NextResponse } from "next/server";

import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import {
  getScanCreditSummary,
  scanCreditsForFollowingCount,
} from "@/lib/scan-credits";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  const targetId = new URL(request.url).searchParams.get("targetId") || "";
  if (!targetId) {
    return NextResponse.json({ error: "targetId is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: target, error } = await supabase
    .from("instagram_targets")
    .select("id, username, following_count, follower_count, is_private")
    .eq("id", targetId)
    .maybeSingle();

  if (error || !target) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (target.is_private) {
    return NextResponse.json(
      { error: "Private accounts cannot be monitored" },
      { status: 403 }
    );
  }

  const credits = await getScanCreditSummary(user.id);
  if (!credits) {
    return NextResponse.json(
      { error: "An active subscription is required" },
      { status: 402 }
    );
  }

  const requiredCredits = scanCreditsForFollowingCount(target.following_count);
  return NextResponse.json({
    success: true,
    target: {
      id: target.id,
      username: target.username,
      followingCount: target.following_count,
      followerCount: target.follower_count,
    },
    requiredCredits,
    credits,
    canAfford: credits.total >= requiredCredits,
  });
}
