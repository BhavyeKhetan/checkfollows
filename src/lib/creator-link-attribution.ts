import crypto from "node:crypto";
import { cookies } from "next/headers";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CHECKFOLLOWS_UGC_APP_SLUG,
  getUgcTrackerClient,
} from "@/lib/ugc-tracker";

export const CREATOR_ATTRIBUTION_COOKIE = "cf_creator_attribution";
export const CREATOR_ATTRIBUTION_WINDOW_SECONDS = 30 * 24 * 60 * 60;

const COOKIE_DOMAIN = "checkfollows-creator-attribution:v1:";
const SAFE_VALUE = /^[a-zA-Z0-9._:-]{1,160}$/;
const CREATOR_PLATFORMS = new Set(["instagram", "tiktok", "youtube", "other", "direct"]);

export type CreatorLinkAttribution = {
  referral_link_id: string;
  creator_engagement_id: string;
  referral_link_slug: string;
  referral_link_platform: string;
  referral_link_source: string;
  referral_click_id: string;
  acquisition_session_id: string;
  creator_attribution_created_at: string;
  creator_attribution_expires_at: string;
};

export type ResolvedCreatorLink = {
  id: string;
  slug: string;
  creatorId: string;
  defaultDestinationPath: string;
  platform: string;
  source: string;
};

function isSafeValue(value: unknown): value is string {
  return typeof value === "string" && SAFE_VALUE.test(value);
}

function isValidAttribution(input: unknown, nowMs = Date.now(), requireCurrent = true): input is CreatorLinkAttribution {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  if (
    !isSafeValue(value.referral_link_id) ||
    !isSafeValue(value.creator_engagement_id) ||
    !isSafeValue(value.referral_link_slug) ||
    !isSafeValue(value.referral_link_platform) ||
    !isSafeValue(value.referral_link_source) ||
    !isSafeValue(value.referral_click_id) ||
    !isSafeValue(value.acquisition_session_id) ||
    typeof value.creator_attribution_created_at !== "string" ||
    typeof value.creator_attribution_expires_at !== "string"
  ) return false;

  const createdAt = Date.parse(value.creator_attribution_created_at);
  const expiresAt = Date.parse(value.creator_attribution_expires_at);
  return Number.isFinite(createdAt)
    && Number.isFinite(expiresAt)
    && createdAt <= nowMs + 5 * 60 * 1000
    && (!requireCurrent || expiresAt > nowMs)
    && expiresAt - createdAt <= CREATOR_ATTRIBUTION_WINDOW_SECONDS * 1000;
}

function signature(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`${COOKIE_DOMAIN}${payload}`).digest("base64url");
}

export function signCreatorAttributionCookie(attribution: CreatorLinkAttribution, secret: string) {
  if (!secret || !isValidAttribution(attribution)) throw new Error("Cannot sign invalid creator attribution");
  const payload = Buffer.from(JSON.stringify(attribution)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyCreatorAttributionCookie(
  token: string | null | undefined,
  secret: string,
  nowMs = Date.now()
): CreatorLinkAttribution | null {
  if (!token || !secret) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(signature(payload, secret));
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return isValidAttribution(parsed, nowMs) ? parsed : null;
  } catch {
    return null;
  }
}

export async function readCreatorAttributionCookie() {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  const token = (await cookies()).get(CREATOR_ATTRIBUTION_COOKIE)?.value;
  return verifyCreatorAttributionCookie(token, secret);
}

export function creatorAttributionToStripeMetadata(
  attribution: CreatorLinkAttribution | null
): Record<string, string> {
  if (!attribution) return {};
  return {
    attr_referral_link_id: attribution.referral_link_id,
    attr_creator_engagement_id: attribution.creator_engagement_id,
    attr_referral_link_slug: attribution.referral_link_slug,
    attr_referral_link_platform: attribution.referral_link_platform,
    attr_referral_link_source: attribution.referral_link_source,
    attr_referral_click_id: attribution.referral_click_id,
    attr_referral_acquisition_session_id: attribution.acquisition_session_id,
    attr_creator_attribution_created_at: attribution.creator_attribution_created_at,
    attr_creator_attribution_expires_at: attribution.creator_attribution_expires_at,
  };
}

export function creatorAttributionFromStripeMetadata(
  metadata: Record<string, string> | null | undefined
): CreatorLinkAttribution | null {
  if (!metadata) return null;
  const candidate = {
    referral_link_id: metadata.attr_referral_link_id,
    creator_engagement_id: metadata.attr_creator_engagement_id,
    referral_link_slug: metadata.attr_referral_link_slug,
    referral_link_platform: metadata.attr_referral_link_platform,
    referral_link_source: metadata.attr_referral_link_source,
    referral_click_id: metadata.attr_referral_click_id,
    acquisition_session_id: metadata.attr_referral_acquisition_session_id,
    creator_attribution_created_at: metadata.attr_creator_attribution_created_at,
    creator_attribution_expires_at: metadata.attr_creator_attribution_expires_at,
  };
  return isValidAttribution(candidate, Date.now(), false) ? candidate : null;
}

function rowFromRpc(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown> | undefined) ?? null;
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

export async function resolveCheckFollowsCreatorLink(
  slug: string,
  supabase: SupabaseClient = getUgcTrackerClient()
): Promise<ResolvedCreatorLink | null> {
  if (!isSafeValue(slug)) return null;
  const { data, error } = await supabase.rpc("resolve_creator_attribution_link", {
    p_app_slug: CHECKFOLLOWS_UGC_APP_SLUG,
    p_slug: slug,
  });
  if (error) throw new Error(`Creator link resolution failed: ${error.message}`);
  const row = rowFromRpc(data);
  if (!row) return null;
  const link = {
    id: row.id,
    slug: row.slug,
    creatorId: row.creator_id,
    defaultDestinationPath: row.destination_path ?? "/",
    platform: row.platform ?? "direct",
    source: row.source ?? "creator_link",
  };
  if (!isSafeValue(link.id) || !isSafeValue(link.slug) || !isSafeValue(link.creatorId)) {
    throw new Error("Creator link RPC returned an invalid CheckFollows link");
  }
  return link as ResolvedCreatorLink;
}

export async function recordCheckFollowsCreatorClick(
  input: {
    linkId: string;
    acquisitionSessionId: string;
    occurredAt: string;
    platform: string;
    source: string;
    landingPath: string;
    referrerHost: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
  },
  supabase: SupabaseClient = getUgcTrackerClient()
) {
  const { data, error } = await supabase.rpc("record_creator_attribution_link_click", {
    p_app_slug: CHECKFOLLOWS_UGC_APP_SLUG,
    p_link_id: input.linkId,
    p_acquisition_session_id: input.acquisitionSessionId,
    p_occurred_at: input.occurredAt,
    p_platform: input.platform,
    p_source: input.source,
    p_landing_path: input.landingPath,
    p_referrer_host: input.referrerHost,
    p_utm_source: input.utmSource,
    p_utm_medium: input.utmMedium,
    p_utm_campaign: input.utmCampaign,
  });
  if (error) throw new Error(`Creator click recording failed: ${error.message}`);
  const row = rowFromRpc(data);
  const clickId = typeof data === "string" ? data : row?.id ?? row?.click_id;
  if (!isSafeValue(clickId)) throw new Error("Creator click RPC returned no click id");
  return clickId;
}

export function safeCreatorDestination(input: string | null | undefined) {
  if (!input || !input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return "/";
  try {
    const parsed = new URL(input, "https://www.checkfollows.com");
    const allowed = ["/", "/pricing", "/onboarding", "/signup", "/login"].some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
    );
    return parsed.origin === "https://www.checkfollows.com" && allowed
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}

export function sanitizeCreatorDimension(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "_");
  return normalized && SAFE_VALUE.test(normalized) ? normalized : fallback;
}

export function sanitizeCreatorPlatform(value: string | null | undefined, fallback: string) {
  const normalized = sanitizeCreatorDimension(value, fallback);
  if (CREATOR_PLATFORMS.has(normalized)) return normalized;
  const normalizedFallback = sanitizeCreatorDimension(fallback, "other");
  return CREATOR_PLATFORMS.has(normalizedFallback) ? normalizedFallback : "other";
}

export function sanitizeOptionalTrackingText(value: string | null | undefined, maxLength = 256) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function parseReferrerHost(value: string | null) {
  if (!value) return null;
  try { return new URL(value).hostname.toLowerCase(); } catch { return null; }
}
