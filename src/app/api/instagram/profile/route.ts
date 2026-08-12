import { NextResponse } from "next/server";
import { getInstagramProvider } from "@/lib/instagram/provider";
import { upsertInstagramTarget } from "@/lib/monitoring";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

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
    const profile = await provider.fetchProfile(cleanUsername);

    if (profile.isPrivate) {
      return NextResponse.json({
        success: false,
        error: "private_account",
        profile: {
          username: profile.username,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          isPrivate: true,
          isVerified: profile.isVerified,
        },
      });
    }

    // Upsert into our database
    const target = await upsertInstagramTarget(profile);

    return NextResponse.json({
      success: true,
      profile: {
        id: target?.id,
        instagramId: profile.userId,
        username: profile.username,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        isPrivate: profile.isPrivate,
        isVerified: profile.isVerified,
        biography: profile.biography,
        externalUrl: profile.externalUrl,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch profile";

    if (message.includes("not found")) {
      return NextResponse.json(
        { success: false, error: "not_found" },
        { status: 404 }
      );
    }

    console.error("Profile fetch error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
