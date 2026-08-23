import { describe, expect, it } from "vitest";

import { scanCreditsForFollowingCount } from "@/lib/scan-credit-policy";

describe("scan credit pricing", () => {
  it("charges one credit for accounts following up to 1,000 profiles", () => {
    expect(scanCreditsForFollowingCount(0)).toBe(1);
    expect(scanCreditsForFollowingCount(609)).toBe(1);
    expect(scanCreditsForFollowingCount(1000)).toBe(1);
  });

  it("rounds each additional 1,000 following profiles up", () => {
    expect(scanCreditsForFollowingCount(1001)).toBe(2);
    expect(scanCreditsForFollowingCount(2500)).toBe(3);
    expect(scanCreditsForFollowingCount(7500)).toBe(8);
  });

  it("handles invalid counts without producing free scans", () => {
    expect(scanCreditsForFollowingCount(Number.NaN)).toBe(1);
    expect(scanCreditsForFollowingCount(-10)).toBe(1);
  });
});
