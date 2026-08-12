import { NextResponse } from "next/server";
import { getInstagramProvider } from "@/lib/instagram/provider";
import { upsertInstagramTarget, scanFollowing, getLatestSnapshot } from "@/lib/monitoring";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const full = searchParams.get("full") === "true";

  if (!username) {
    return NextResponse.json(
      { success: false, error: "Username is required" },
      { status: 400 }
    );
  }

  const cleanUsername = username.replace(/^@/, "").trim();

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
    return NextResponse.json(
      { success: false, error: "Invalid Instagram username" },
      { status: 400 }
    );
  }

  try {
    const provider = getInstagramProvider();

    // Get profile and upsert
    const profile = await provider.fetchProfile(cleanUsername);

    if (profile.isPrivate) {
      return NextResponse.json({
        success: false,
        error: "private_account",
      });
    }

    const target = await upsertInstagramTarget(profile);
    if (!target) {
      return NextResponse.json(
        { success: false, error: "Failed to save target" },
        { status: 500 }
      );
    }

    // Fetch following list via batch scan
    const result = await provider.batchScan({
      usernames: [cleanUsername],
      dataToScrape: "Followings",
      maxResultsPerUser: 0,
    });

    if (!result.success) {
      throw new Error(result.runMetadata.error || "Failed to fetch follows");
    }

    const entries = result.entries.get(cleanUsername.toLowerCase()) || [];

    // Check if we have historical data
    const prevSnapshot = await getLatestSnapshot(target.id, "following");
    const hasHistory = prevSnapshot !== null;

    if (full) {
      // Full scan: run diff + store new snapshot
      await scanFollowing(target.id);
    }

    const followingList = entries.map((u) => ({
      instagramId: u.userId,
      username: u.username,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      isVerified: u.isVerified,
      isPrivate: u.isPrivate,
    }));

    return NextResponse.json({
      success: true,
      targetId: target.id,
      following: followingList,
      hasHistory,
      isFirstSearch: !hasHistory,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch follows";

    if (message.includes("not found")) {
      return NextResponse.json(
        { success: false, error: "not_found" },
        { status: 404 }
      );
    }

    console.error("Follows fetch error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
