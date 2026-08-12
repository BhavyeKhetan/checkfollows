/**
 * Events endpoint — returns detected follow changes for a target.
 * GET /api/instagram/events?targetId=xxx
 */

import { NextResponse } from "next/server";
import { getEventsForTarget } from "@/lib/monitoring";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("targetId");

  if (!targetId) {
    return NextResponse.json({ success: false, error: "targetId is required" }, { status: 400 });
  }

  try {
    const events = await getEventsForTarget(targetId, {
      limit: 100,
      confirmedOnly: false,
    });

    return NextResponse.json({
      success: true,
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    console.error("Events fetch error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
