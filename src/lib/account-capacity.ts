import "server-only";

import type Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";
import {
  ADDITIONAL_ACCOUNT_UNIT_AMOUNTS,
  getStripe,
  type BillingCadence,
  type PlanTier,
} from "@/lib/stripe";
import {
  INCLUDED_ACCOUNTS,
  cadenceFromSubscription,
  findAdditionalAccountItem,
  tierFromSubscription,
} from "@/lib/account-capacity-rules";

export interface AccountCapacity {
  stripeSubscriptionId: string;
  tier: PlanTier;
  cadence: BillingCadence;
  includedAccounts: number;
  additionalAccounts: number;
  totalAccounts: number;
  unitAmount: number;
  activeAccounts: number;
  addonItemId: string | null;
  stripeSubscription: Stripe.Subscription;
}

interface SubscriptionRow {
  stripe_subscription_id: string | null;
  tier: string;
  updated_at: string;
}

function isStripeSubscriptionUsable(subscription: Stripe.Subscription): boolean {
  return (
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due"
  );
}

/**
 * Resolve capacity from Stripe, which is the billing source of truth. Supabase
 * only identifies subscriptions owned by the authenticated user and counts the
 * target rows attached to the selected Stripe subscription.
 */
export async function getAccountCapacity(
  userId: string
): Promise<AccountCapacity | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, tier, updated_at")
    .eq("user_id", userId)
    .not("stripe_subscription_id", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to load subscription capacity: ${error.message}`);

  const uniqueRows = Array.from(
    new Map(
      ((data || []) as SubscriptionRow[])
        .filter((row) => !!row.stripe_subscription_id)
        .map((row) => [row.stripe_subscription_id as string, row])
    ).values()
  );

  const stripe = getStripe();
  for (const row of uniqueRows) {
    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(
        row.stripe_subscription_id as string,
        { expand: ["items.data.price"] }
      );
    } catch (error) {
      console.error("capacity: failed to retrieve Stripe subscription", {
        subscriptionId: row.stripe_subscription_id,
        error,
      });
      continue;
    }

    if (!isStripeSubscriptionUsable(subscription)) continue;

    const cadence = cadenceFromSubscription(subscription);
    const tier = tierFromSubscription(subscription, row.tier);
    const addonItem = findAdditionalAccountItem(subscription, cadence);
    const additionalAccounts = Math.max(0, addonItem?.quantity || 0);
    const includedAccounts = INCLUDED_ACCOUNTS[tier];

    const { count, error: countError } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("stripe_subscription_id", subscription.id)
      .eq("active", true)
      .eq("user_paused", false)
      .not("target_id", "is", null);

    if (countError) {
      throw new Error(`Failed to count active accounts: ${countError.message}`);
    }

    return {
      stripeSubscriptionId: subscription.id,
      tier,
      cadence,
      includedAccounts,
      additionalAccounts,
      totalAccounts: includedAccounts + additionalAccounts,
      unitAmount: ADDITIONAL_ACCOUNT_UNIT_AMOUNTS[cadence],
      activeAccounts: count || 0,
      addonItemId: addonItem?.id || null,
      stripeSubscription: subscription,
    };
  }

  return null;
}

export function publicCapacity(capacity: AccountCapacity) {
  return {
    tier: capacity.tier,
    cadence: capacity.cadence,
    includedAccounts: capacity.includedAccounts,
    additionalAccounts: capacity.additionalAccounts,
    totalAccounts: capacity.totalAccounts,
    activeAccounts: capacity.activeAccounts,
    availableAccounts: Math.max(0, capacity.totalAccounts - capacity.activeAccounts),
    unitAmount: capacity.unitAmount,
    currency: "usd" as const,
  };
}
