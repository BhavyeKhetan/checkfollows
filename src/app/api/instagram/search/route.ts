/**
 * Two-stage search endpoint:
 *   POST { username, stage?: "preview" | "full" }
 *
 *   stage=preview (default): Lightweight profile lookup + capped 10-20 following preview.
 *     Uses apify/instagram-profile-scraper (cheap). No baseline stored.
 *
 *   stage=full (paid): Complete following scrape + baseline snapshot + enable monitoring.
 *     Uses dead00/instagram-followers-following-scraper-no-cookies.
 */

import { NextResponse } from "next/server";
import {
  getAuthUser,
  hasActiveSubscription,
  ownsTarget,
} from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import { previewLookup, fullBaselineScan, getEventsForTarget } from "@/lib/monitoring";

export async function POST(request: Request) {
  try {
    const { username, stage } = await request.json();

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).replace(/^@/, "").trim();

    if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
      return NextResponse.json(
        { success: false, error: "Invalid Instagram username" },
        { status: 400 }
      );
    }

    // ─── PREVIEW stage (unpaid, default) ──────────────────
    if (stage !== "full") {
      const result = await previewLookup(cleanUsername);

      return NextResponse.json({
        success: true,
        stage: "preview",
        target: result.target,
        profile: result.profile,
        followingPreview: result.followingPreview.map((u) => ({
          instagramId: u.userId,
          username: u.username,
          fullName: u.fullName,
          avatarUrl: u.avatarUrl,
          isVerified: u.isVerified,
          isPrivate: u.isPrivate,
        })),
        followersPreview: result.followersPreview.map((u) => ({
          instagramId: u.userId,
          username: u.username,
          fullName: u.fullName,
          avatarUrl: u.avatarUrl,
          isVerified: u.isVerified,
          isPrivate: u.isPrivate,
        })),
        previewCap: result.followingPreview.length, // actual count returned
      });
    }

    // ─── FULL stage (paid) ───────────────────────────────
    // Entitlement gate: only run the expensive full baseline for an
    // authenticated user with an active Stripe-backed subscription.
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sign in to run a full scan" },
        { status: 401 }
      );
    }

    const entitled = await hasActiveSubscription(user.id);
    if (!entitled) {
      return NextResponse.json(
        { success: false, error: "An active subscription is required to run a full scan" },
        { status: 402 }
      );
    }

    const { data: ownedTarget } = await createServerClient()
      .from("instagram_targets")
      .select("id")
      .eq("username", cleanUsername.toLowerCase())
      .maybeSingle();
    if (
      !ownedTarget ||
      !(await ownsTarget(user.id, ownedTarget.id, user.email))
    ) {
      return NextResponse.json(
        { success: false, error: "Add this account to your subscription first" },
        { status: 403 }
      );
    }

    const result = await fullBaselineScan(cleanUsername);

    const events = await getEventsForTarget(result.target.id, {
      limit: 50,
      confirmedOnly: true,
    });

    return NextResponse.json({
      success: true,
      stage: "full",
      target: result.target,
      following: result.following.map((u) => ({
        instagramId: u.userId,
        username: u.username,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        isVerified: u.isVerified,
        isPrivate: u.isPrivate,
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
      isBaseline: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";

    if (message.includes("private")) {
      return NextResponse.json(
        { success: false, error: "private_account" },
        { status: 403 }
      );
    }
    if (
      message.includes("not found") ||
      message.includes("no following data")
    ) {
      return NextResponse.json(
        { success: false, error: "not_found" },
        { status: 404 }
      );
    }

    console.error("Search error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
