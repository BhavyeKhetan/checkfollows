import { NextResponse } from "next/server";
import { fetchProfileByUsername, fetchFollowing } from "@/lib/hikerapi";
import { upsertInstagramTarget, scanFollowing, getLatestSnapshot } from "@/lib/monitoring";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const full = searchParams.get("full") === "true";

  if (!username) {
    return NextResponse.json({ success: false, error: "Username is required" }, { status: 400 });
  }

  const cleanUsername = username.replace(/^@/, "").trim();

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
    return NextResponse.json({ success: false, error: "Invalid Instagram username" }, { status: 400 });
  }

  try {
    // Get profile and upsert
    const profile = await fetchProfileByUsername(cleanUsername);

    if (profile.is_private) {
      return NextResponse.json({
        success: false,
        error: "private_account",
      });
    }

    const target = await upsertInstagramTarget(profile);
    if (!target) {
      return NextResponse.json({ success: false, error: "Failed to save target" }, { status: 500 });
    }

    // Fetch following list
    const following = await fetchFollowing(profile.pk);

    // Check if we have historical data (previous snapshots → we have events)
    const prevSnapshot = await getLatestSnapshot(target.id, "following");
    const hasHistory = prevSnapshot !== null;

    if (full) {
      // Full scan: run diff + store new snapshot
      await scanFollowing(target.id);
    }

    // Map to clean response format
    const followingList = following.map((u) => ({
      instagramId: u.pk,
      username: u.username,
      fullName: u.full_name,
      avatarUrl: u.profile_pic_url,
      isVerified: u.is_verified,
      isPrivate: u.is_private,
    }));

    return NextResponse.json({
      success: true,
      targetId: target.id,
      following: followingList,
      hasHistory,
      // If we have history, the "recent" ordering is based on our diff engine
      // For first-time search, return Instagram's order as-is
      isFirstSearch: !hasHistory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch follows";

    if (message.includes("404") || message.includes("not found")) {
      return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
    }

    console.error("Follows fetch error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
