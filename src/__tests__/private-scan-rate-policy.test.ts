/**
 * Tests for private scan rate policy (src/lib/private-scan/rate-policy.ts).
 *
 * Since rate-policy uses Supabase, we test the viewer throttle stub
 * and the constants/lit edges. Full integration tested via API routes.
 */

import { describe, it, expect } from "vitest";
import { isViewerThrottled } from "@/lib/private-scan/rate-policy";

describe("isViewerThrottled", () => {
  it("currently returns false regardless of inputs", () => {
    expect(isViewerThrottled("abc123", "testuser")).toBe(false);
    expect(isViewerThrottled(null, null)).toBe(false);
    expect(isViewerThrottled("abc", null)).toBe(false);
  });
});