import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  INCLUDED_ACCOUNTS,
  cadenceFromSubscription,
  findAdditionalAccountItem,
  tierFromSubscription,
} from "../lib/account-capacity-rules";
import { ADDITIONAL_ACCOUNT_UNIT_AMOUNTS } from "../lib/stripe";

function subscriptionFixture(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: "sub_test",
    object: "subscription",
    metadata: {},
    status: "active",
    items: {
      object: "list",
      data: [],
      has_more: false,
      url: "/v1/subscription_items?subscription=sub_test",
    },
    ...overrides,
  } as Stripe.Subscription;
}

describe("account capacity pricing", () => {
  it("keeps the promised included concurrent slots", () => {
    expect(INCLUDED_ACCOUNTS).toEqual({ base: 3, premium: 5 });
  });

  it("charges $1 weekly and $14 quarterly per additional slot", () => {
    expect(ADDITIONAL_ACCOUNT_UNIT_AMOUNTS).toEqual({
      weekly: 100,
      quarterly: 1400,
    });
  });

  it("prefers billing cadence and tier from Stripe metadata", () => {
    const subscription = subscriptionFixture({
      metadata: { cadence: "quarterly", tier: "premium" },
    });
    expect(cadenceFromSubscription(subscription)).toBe("quarterly");
    expect(tierFromSubscription(subscription, "base")).toBe("premium");
  });

  it("falls back to a three-month recurring base item", () => {
    const subscription = subscriptionFixture({
      items: {
        object: "list",
        has_more: false,
        url: "/v1/subscription_items?subscription=sub_test",
        data: [
          {
            id: "si_base",
            object: "subscription_item",
            metadata: {},
            quantity: 1,
            price: {
              id: "price_base",
              object: "price",
              recurring: { interval: "month", interval_count: 3 },
            },
          } as Stripe.SubscriptionItem,
        ],
      },
    });
    expect(cadenceFromSubscription(subscription)).toBe("quarterly");
  });

  it("finds the add-on item by server-authored metadata", () => {
    const addon = {
      id: "si_addon",
      object: "subscription_item",
      metadata: { checkfollows_kind: "additional_accounts" },
      quantity: 12,
      price: { id: "price_addon", object: "price" },
    } as unknown as Stripe.SubscriptionItem;
    const subscription = subscriptionFixture({
      items: {
        object: "list",
        data: [addon],
        has_more: false,
        url: "/v1/subscription_items?subscription=sub_test",
      },
    });
    expect(findAdditionalAccountItem(subscription, "weekly")?.quantity).toBe(12);
  });
});
