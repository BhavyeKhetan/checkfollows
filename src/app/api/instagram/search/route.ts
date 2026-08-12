/**
 * Combined search endpoint — profile + following + first scan in one call.
 * POST { username: string } → returns profile + following list + initial events.
 */

import { NextResponse } from "next/server";
import { initialScan, getEventsForTarget } from "@/lib/monitoring";

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ success: false, error: "Username is required" }, { status: 400 });
    }

    const cleanUsername = String(username).replace(/^@/, "").trim();

    if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
      return NextResponse.json({ success: false, error: "Invalid Instagram username" }, { status: 400 });
    }

    const result = await initialScan(cleanUsername);

    // Get any existing events (for returning users)
    const events = await getEventsForTarget(result.target.id, {
      limit: 50,
      confirmedOnly: true,
    });

    return NextResponse.json({
      success: true,
      target: result.target,
      following: result.following.map((u) => ({
        instagramId: u.pk,
        username: u.username,
        fullName: u.full_name,
        avatarUrl: u.profile_pic_url,
        isVerified: u.is_verified,
        isPrivate: u.is_private,
      })),
      events: events.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        instagramId: e.instagram_id,
        username: e.username,
        fullName: e.full_name,
        avatarUrl: e.avatar_url,
        isVerified: e.is_verified,
        detectedAt: e.detected_at,
        confirmed: e.confirmed,
      })),
      scanId: result.scanId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";

    if (message.includes("private")) {
      return NextResponse.json({ success: false, error: "private_account" }, { status: 403 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
    }

    console.error("Search error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
