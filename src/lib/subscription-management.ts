import type Stripe from "stripe";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import type { AuthUser } from "@/lib/supabase/auth";
import {
  EMAIL_ALERTS_PRICE_IDS,
  PREMIUM_PRICE_IDS,
  PRICE_IDS,
  type PlanTier,
} from "@/lib/stripe";

export type BillingCadence = "weekly" | "quarterly";

export interface SubscriptionSelection {
  cadence: BillingCadence;
  tier: PlanTier;
  emailAlerts: boolean;
}

export interface OwnedStripeSubscription {
  customerId: string;
  subscription: Stripe.Subscription;
}

const MANAGEABLE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);

export function subscriptionSelection(
  subscription: Stripe.Subscription
): SubscriptionSelection {
  const priceIds = new Set(subscription.items.data.map((item) => item.price.id));

  for (const cadence of ["weekly", "quarterly"] as const) {
    if (priceIds.has(PREMIUM_PRICE_IDS[cadence])) {
      return {
        cadence,
        tier: "premium",
        emailAlerts: priceIds.has(EMAIL_ALERTS_PRICE_IDS[cadence]),
      };
    }
    if (priceIds.has(PRICE_IDS[cadence])) {
      return {
        cadence,
        tier: "base",
        emailAlerts: priceIds.has(EMAIL_ALERTS_PRICE_IDS[cadence]),
      };
    }
  }

  return {
    cadence:
      subscription.metadata.cadence === "quarterly" ? "quarterly" : "weekly",
    tier: subscription.metadata.tier === "premium" ? "premium" : "base",
    emailAlerts: subscription.metadata.email_alerts === "true",
  };
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription): number {
  const itemEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value));
  return itemEnds.length > 0 ? Math.max(...itemEnds) : subscription.created;
}

export function isManageableSubscription(subscription: Stripe.Subscription): boolean {
  return MANAGEABLE_STATUSES.has(subscription.status);
}

/**
 * Resolve a Stripe subscription only through rows owned by the authenticated
 * Supabase user. Email is a legacy fallback; arbitrary client IDs are never
 * accepted.
 */
export async function getOwnedStripeSubscription(
  user: AuthUser
): Promise<OwnedStripeSubscription | null> {
  const supabase = createServerClient();

  let { data: rows } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, active, created_at")
    .eq("user_id", user.id)
    .not("stripe_subscription_id", "is", null)
    .order("active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if ((!rows || rows.length === 0) && user.email) {
    const legacy = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, active, created_at")
      .eq("email", user.email.toLowerCase())
      .not("stripe_subscription_id", "is", null)
      .order("active", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    rows = legacy.data;
  }

  if (!rows || rows.length === 0) return null;

  const stripe = getStripe();
  const customerIds = [
    ...new Set(
      rows
        .map((row) => row.stripe_customer_id)
        .filter((id): id is string => !!id)
    ),
  ];

  for (const customerId of customerIds) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const manageable = subscriptions.data.find(isManageableSubscription);
    if (manageable) return { customerId, subscription: manageable };
  }

  for (const row of rows) {
    if (!row.stripe_subscription_id) continue;
    try {
      const subscription = await stripe.subscriptions.retrieve(
        row.stripe_subscription_id
      );
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      return { customerId, subscription };
    } catch (error) {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (statusCode !== 404) throw error;
    }
  }

  return null;
}

export function appReturnOrigin(request: Request): string {
  const origin = new URL(request.url).origin;
  if (origin === "https://app.checkfollows.com") return origin;
  if (origin.startsWith("http://localhost:")) return origin;
  return "https://app.checkfollows.com";
}
