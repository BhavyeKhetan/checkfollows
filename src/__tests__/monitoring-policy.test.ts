import { describe, expect, it } from "vitest";

import { shouldRunAutomatedFollowingScan } from "@/lib/monitoring-policy";
import { decideAutomatedFollowingAction } from "@/lib/instagram/account-eligibility";

describe("automated monitoring cost gate", () => {
  it("skips a paid full scan when the following count is unchanged", () => {
    expect(shouldRunAutomatedFollowingScan(609, 609)).toBe(false);
  });

  it("runs a paid full scan when the following count increases", () => {
    expect(shouldRunAutomatedFollowingScan(609, 610)).toBe(true);
  });

  it("runs a paid full scan when the following count decreases", () => {
    expect(shouldRunAutomatedFollowingScan(609, 608)).toBe(true);
  });
});

describe("private account monitoring gate", () => {
  it("stops before a baseline or full scan when the profile is private", () => {
    expect(
      decideAutomatedFollowingAction({
        isPrivate: true,
        hasBaseline: false,
        storedFollowingCount: 0,
        observedFollowingCount: 609,
      })
    ).toBe("stop_private");
  });

  it("stops a previously public account before scanning when it becomes private", () => {
    expect(
      decideAutomatedFollowingAction({
        isPrivate: true,
        hasBaseline: true,
        storedFollowingCount: 609,
        observedFollowingCount: 610,
      })
    ).toBe("stop_private");
  });

  it("keeps the unchanged public-profile cost gate", () => {
    expect(
      decideAutomatedFollowingAction({
        isPrivate: false,
        hasBaseline: true,
        storedFollowingCount: 609,
        observedFollowingCount: 609,
      })
    ).toBe("skip_unchanged");
  });
});
