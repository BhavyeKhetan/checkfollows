import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  isManageableSubscription,
  subscriptionPeriodEnd,
  subscriptionSelection,
} from "@/lib/subscription-management";

function subscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: "sub_test",
    object: "subscription",
    created: 100,
    status: "active",
    metadata: {},
    items: {
      object: "list",
      data: [],
      has_more: false,
      url: "/v1/subscription_items",
    },
    ...overrides,
  } as Stripe.Subscription;
}

describe("subscription management", () => {
  it("uses metadata when legacy price IDs cannot be mapped", () => {
    const result = subscriptionSelection(
      subscription({
        metadata: {
          cadence: "quarterly",
          tier: "premium",
          email_alerts: "true",
        },
      })
    );
    expect(result).toEqual({
      cadence: "quarterly",
      tier: "premium",
      emailAlerts: true,
    });
  });

  it("uses the latest item period end", () => {
    const result = subscriptionPeriodEnd(
      subscription({
        items: {
          object: "list",
          data: [
            { current_period_end: 200 },
            { current_period_end: 300 },
          ] as Stripe.SubscriptionItem[],
          has_more: false,
          url: "/v1/subscription_items",
        },
      })
    );
    expect(result).toBe(300);
  });

  it("allows active billing states but rejects ended subscriptions", () => {
    expect(isManageableSubscription(subscription({ status: "active" }))).toBe(true);
    expect(isManageableSubscription(subscription({ status: "past_due" }))).toBe(true);
    expect(isManageableSubscription(subscription({ status: "canceled" }))).toBe(false);
  });
});
