import { describe, expect, it } from "vitest";

import { shouldRunAutomatedFollowingScan } from "@/lib/monitoring-policy";

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
