import type Stripe from "stripe";
import {
  ADDITIONAL_ACCOUNT_PRICE_IDS,
  type BillingCadence,
  type PlanTier,
} from "./stripe";

export const INCLUDED_ACCOUNTS: Record<PlanTier, number> = {
  base: 3,
  premium: 5,
};

// A bounded request guard, not a commercial cap. Customers can contact support
// above this operationally generous limit; the normal UI supports 50+ accounts.
export const MAX_ADDITIONAL_ACCOUNTS = 500;
export const ADDITIONAL_ACCOUNT_ITEM_KIND = "additional_accounts";

export function cadenceFromSubscription(
  subscription: Stripe.Subscription
): BillingCadence {
  if (subscription.metadata?.cadence === "quarterly") return "quarterly";
  if (subscription.metadata?.cadence === "weekly") return "weekly";

  const recurring = subscription.items.data.find(
    (item) => item.metadata?.checkfollows_kind !== ADDITIONAL_ACCOUNT_ITEM_KIND
  )?.price.recurring;
  return recurring?.interval === "month" && recurring.interval_count === 3
    ? "quarterly"
    : "weekly";
}

export function tierFromSubscription(
  subscription: Stripe.Subscription,
  fallbackTier: string
): PlanTier {
  return subscription.metadata?.tier === "premium" || fallbackTier === "premium"
    ? "premium"
    : "base";
}

export function findAdditionalAccountItem(
  subscription: Stripe.Subscription,
  cadence: BillingCadence
): Stripe.SubscriptionItem | undefined {
  const configuredPriceId = ADDITIONAL_ACCOUNT_PRICE_IDS[cadence];
  return subscription.items.data.find(
    (item) =>
      item.metadata?.checkfollows_kind === ADDITIONAL_ACCOUNT_ITEM_KIND ||
      (!!configuredPriceId && item.price.id === configuredPriceId)
  );
}
