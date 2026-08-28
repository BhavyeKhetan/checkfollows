import { describe, expect, it } from "vitest";
import { subscriptionPrice } from "../components/subscription/subscription-plan-picker";

describe("subscription plan pricing", () => {
  it("prices Basic and Premium for each billing cadence", () => {
    expect(subscriptionPrice("weekly", "base", false)).toBe(9.99);
    expect(subscriptionPrice("weekly", "premium", false)).toBe(12.99);
    expect(subscriptionPrice("quarterly", "base", false)).toBe(99);
    expect(subscriptionPrice("quarterly", "premium", false)).toBe(129);
  });

  it("adds the matching email-alert price", () => {
    expect(subscriptionPrice("weekly", "base", true)).toBe(11.99);
    expect(subscriptionPrice("quarterly", "premium", true)).toBe(139);
  });
});
