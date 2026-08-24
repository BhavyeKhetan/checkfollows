/**
 * Profile search endpoint:
 *   POST { username, stage?: "preview" }
 *
 *   stage=preview (default): Lightweight profile lookup + capped 10-20 following preview.
 *     Uses apify/instagram-profile-scraper (cheap). No baseline stored.
 *
 * Expensive full scans are intentionally rejected here. They must go through
 * the post-paywall confirmation, scheduler, or /api/instagram/rescan so the
 * account-size credit reservation cannot be bypassed.
 */

import { NextResponse } from "next/server";
import { previewLookup } from "@/lib/monitoring";
import {
  PRIVATE_ACCOUNT_CODE,
  PRIVATE_ACCOUNT_MESSAGE,
} from "@/lib/instagram/account-eligibility";
import {
  extractInstagramUsername,
  isValidInstagramUsername,
} from "@/lib/instagram/normalize";

export async function POST(request: Request) {
  try {
    const { username, stage } = await request.json();

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const cleanUsername = extractInstagramUsername(String(username));

    if (!isValidInstagramUsername(cleanUsername)) {
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

    return NextResponse.json({
      success: false,
      error: "Full scans require scan-credit confirmation. Start from the tracked account page.",
      needsScanConfirmation: true,
    }, { status: 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";

    if (message.includes("private")) {
      return NextResponse.json(
        {
          success: false,
          code: PRIVATE_ACCOUNT_CODE,
          error: PRIVATE_ACCOUNT_MESSAGE,
        },
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
