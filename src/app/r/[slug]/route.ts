import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  CREATOR_ATTRIBUTION_COOKIE,
  CREATOR_ATTRIBUTION_WINDOW_SECONDS,
  parseReferrerHost,
  recordCheckFollowsCreatorClick,
  resolveCheckFollowsCreatorLink,
  safeCreatorDestination,
  sanitizeCreatorDimension,
  sanitizeCreatorPlatform,
  sanitizeOptionalTrackingText,
  signCreatorAttributionCookie,
} from "@/lib/creator-link-attribution";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Creator attribution is unavailable" }, { status: 503 });

  try {
    const link = await resolveCheckFollowsCreatorLink(slug);
    if (!link) return NextResponse.redirect(new URL("/", request.url), 302);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CREATOR_ATTRIBUTION_WINDOW_SECONDS * 1000);
    const acquisitionSessionId = crypto.randomUUID();
    const referrerHost = parseReferrerHost(request.headers.get("referer"));
    const inferredPlatform = referrerHost?.includes("instagram")
      ? "instagram"
      : referrerHost?.includes("tiktok") ? "tiktok" : link.platform;
    const platform = sanitizeCreatorPlatform(
      request.nextUrl.searchParams.get("platform") ?? request.nextUrl.searchParams.get("utm_source"),
      inferredPlatform
    );
    const source = sanitizeCreatorDimension(
      request.nextUrl.searchParams.get("source") ?? request.nextUrl.searchParams.get("utm_medium"),
      link.source
    );
    const destination = safeCreatorDestination(link.defaultDestinationPath);
    const clickId = await recordCheckFollowsCreatorClick({
      linkId: link.id,
      acquisitionSessionId,
      occurredAt: now.toISOString(),
      platform,
      source,
      landingPath: destination,
      referrerHost,
      utmSource: sanitizeOptionalTrackingText(request.nextUrl.searchParams.get("utm_source")),
      utmMedium: sanitizeOptionalTrackingText(request.nextUrl.searchParams.get("utm_medium")),
      utmCampaign: sanitizeOptionalTrackingText(request.nextUrl.searchParams.get("utm_campaign")),
    });
    const attribution = {
      referral_link_id: link.id,
      creator_engagement_id: link.creatorId,
      referral_link_slug: link.slug,
      referral_link_platform: platform,
      referral_link_source: source,
      referral_click_id: clickId,
      acquisition_session_id: acquisitionSessionId,
      creator_attribution_created_at: now.toISOString(),
      creator_attribution_expires_at: expiresAt.toISOString(),
    };
    const response = NextResponse.redirect(new URL(destination, request.url), 302);
    response.cookies.set(CREATOR_ATTRIBUTION_COOKIE, signCreatorAttributionCookie(attribution, secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CREATOR_ATTRIBUTION_WINDOW_SECONDS,
      expires: expiresAt,
    });
    return response;
  } catch (error) {
    console.error("CheckFollows creator referral redirect failed", error);
    return NextResponse.json({ error: "Creator attribution is unavailable" }, { status: 503 });
  }
}
