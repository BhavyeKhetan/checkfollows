import { describe, expect, it } from "vitest";
import { removalPolicy } from "../lib/account-removal";

describe("tracked account removal policy", () => {
  it("lets Premium remove at any time", () => {
    const last = "2026-08-20T00:00:00.000Z";
    const policy = removalPolicy("premium", last, Date.parse("2026-08-21T00:00:00.000Z"));
    expect(policy.canRemove).toBe(true);
    expect(policy.nextRemoveAt).toBeNull();
    expect(policy.cooldownDays).toBe(0);
  });

  it("lets Basic remove when they have never removed an account", () => {
    const policy = removalPolicy("base", null);
    expect(policy.canRemove).toBe(true);
    expect(policy.cooldownDays).toBe(7);
  });

  it("blocks Basic for 7 days after a removal", () => {
    const last = "2026-08-20T12:00:00.000Z";
    const policy = removalPolicy("base", last, Date.parse("2026-08-21T12:00:00.000Z"));
    expect(policy.canRemove).toBe(false);
    expect(policy.nextRemoveAt).toBe("2026-08-27T12:00:00.000Z");
  });

  it("allows Basic again after the 7-day cooldown", () => {
    const last = "2026-08-14T12:00:00.000Z";
    const policy = removalPolicy("base", last, Date.parse("2026-08-21T12:00:00.000Z"));
    expect(policy.canRemove).toBe(true);
    expect(policy.nextRemoveAt).toBeNull();
  });
});
