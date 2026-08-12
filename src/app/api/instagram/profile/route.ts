import { NextResponse } from "next/server";
import { fetchProfileByUsername } from "@/lib/hikerapi";
import { upsertInstagramTarget } from "@/lib/monitoring";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ success: false, error: "Username is required" }, { status: 400 });
  }

  const cleanUsername = username.replace(/^@/, "").trim();

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
    return NextResponse.json({ success: false, error: "Invalid Instagram username" }, { status: 400 });
  }

  try {
    const profile = await fetchProfileByUsername(cleanUsername);

    if (profile.is_private) {
      return NextResponse.json({
        success: false,
        error: "private_account",
        profile: {
          username: profile.username,
          fullName: profile.full_name,
          avatarUrl: profile.profile_pic_url,
          isPrivate: true,
          isVerified: profile.is_verified,
        },
      });
    }

    // Upsert into our database (builds the historical index)
    const target = await upsertInstagramTarget(profile);

    return NextResponse.json({
      success: true,
      profile: {
        id: target?.id,
        instagramId: profile.pk,
        username: profile.username,
        fullName: profile.full_name,
        avatarUrl: profile.profile_pic_url,
        followerCount: profile.follower_count,
        followingCount: profile.following_count,
        isPrivate: profile.is_private,
        isVerified: profile.is_verified,
        biography: profile.biography,
        externalUrl: profile.external_url,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch profile";

    // Handle HikerAPI-specific errors
    if (message.includes("404") || message.includes("not found")) {
      return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
    }

    console.error("Profile fetch error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
