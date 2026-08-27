import { describe, expect, it } from "vitest";

import {
  creatorAttributionFromStripeMetadata,
  creatorAttributionToStripeMetadata,
  safeCreatorDestination,
  signCreatorAttributionCookie,
  verifyCreatorAttributionCookie,
  type CreatorLinkAttribution,
} from "./creator-link-attribution";

const now = Date.parse("2026-08-27T20:00:00.000Z");
const attribution: CreatorLinkAttribution = {
  referral_link_id: "11111111-1111-4111-8111-111111111111",
  creator_engagement_id: "22222222-2222-4222-8222-222222222222",
  referral_link_slug: "creator-name",
  referral_link_platform: "instagram",
  referral_link_source: "instagram_bio",
  referral_click_id: "33333333-3333-4333-8333-333333333333",
  acquisition_session_id: "44444444-4444-4444-8444-444444444444",
  creator_attribution_created_at: new Date(now).toISOString(),
  creator_attribution_expires_at: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

describe("CheckFollows creator attribution", () => {
  it("signs and verifies an HttpOnly-cookie payload", () => {
    const token = signCreatorAttributionCookie(attribution, "secret");
    expect(verifyCreatorAttributionCookie(token, "secret", now)).toEqual(attribution);
    expect(verifyCreatorAttributionCookie(token, "wrong-secret", now)).toBeNull();
  });

  it("round-trips the immutable Stripe attribution metadata", () => {
    const metadata = creatorAttributionToStripeMetadata(attribution);
    expect(creatorAttributionFromStripeMetadata(metadata)).toEqual(attribution);
  });

  it("allows only local acquisition destinations", () => {
    expect(safeCreatorDestination("/pricing")).toBe("/pricing");
    expect(safeCreatorDestination("https://evil.test")).toBe("/");
    expect(safeCreatorDestination("//evil.test")).toBe("/");
  });
});
