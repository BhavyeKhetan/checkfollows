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

/** Billing that must not be replaced by a second Checkout / Payment Element sub. */
const LIVE_BILLING_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);

export function isLiveBillingSubscription(
  subscription: Stripe.Subscription
): boolean {
  return LIVE_BILLING_STATUSES.has(subscription.status);
}

export const ALREADY_SUBSCRIBED_CODE = "already_subscribed";

export const ALREADY_SUBSCRIBED_MESSAGE =
  "You already have a CheckFollows subscription. Sign in to your account to add concurrent slots instead of starting a new plan.";

export async function findLiveCustomerSubscription(
  customerId: string,
  excludeSubscriptionId?: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  const live = subscriptions.data
    .filter(
      (subscription) =>
        isLiveBillingSubscription(subscription) &&
        subscription.id !== excludeSubscriptionId
    )
    .sort((a, b) => a.created - b.created);
  return live[0] || null;
}

export async function findReusableIncompleteSubscription(
  customerId: string,
  priceIds: string[]
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();
  const wanted = [...priceIds].sort().join(",");
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "incomplete",
    limit: 10,
    expand: ["data.latest_invoice.confirmation_secret"],
  });
  return (
    subscriptions.data.find((subscription) => {
      const have = subscription.items.data
        .map((item) => item.price.id)
        .sort()
        .join(",");
      return have === wanted;
    }) || null
  );
}

/**
 * Another paid Stripe subscription already on this email / user, if any.
 * Extra Instagram accounts belong on that subscription as slots, not a new plan.
 */
export async function findCanonicalStripeBilling(opts: {
  userId?: string | null;
  email?: string | null;
  excludeSubscriptionId?: string;
}): Promise<{
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  userId: string | null;
  email: string;
} | null> {
  const supabase = createServerClient();
  const exclude = opts.excludeSubscriptionId || "";

  const byUser =
    opts.userId
      ? await supabase
          .from("subscriptions")
          .select("stripe_subscription_id, stripe_customer_id, user_id, email, active, updated_at")
          .eq("user_id", opts.userId)
          .eq("active", true)
          .not("stripe_subscription_id", "is", null)
          .order("updated_at", { ascending: true })
          .limit(20)
      : { data: null as null };

  let rows = byUser.data || [];
  if (rows.length === 0 && opts.email) {
    const byEmail = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id, user_id, email, active, updated_at")
      .eq("email", opts.email.toLowerCase())
      .eq("active", true)
      .not("stripe_subscription_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(20);
    rows = byEmail.data || [];
  }

  const canonical = rows.find(
    (row) =>
      !!row.stripe_subscription_id &&
      row.stripe_subscription_id !== exclude
  );
  if (!canonical?.stripe_subscription_id) return null;

  return {
    stripeSubscriptionId: canonical.stripe_subscription_id,
    stripeCustomerId: canonical.stripe_customer_id,
    userId: canonical.user_id,
    email: canonical.email,
  };
}

/**
 * If this incoming Stripe subscription would be a second plan for the same
 * buyer, attach any target to the existing plan and cancel the duplicate.
 * Returns the Stripe subscription id that should be persisted.
 */
export async function collapseDuplicateStripeSubscription(opts: {
  incomingSubscriptionId: string;
  customerId: string;
  email: string;
  userId?: string | null;
  targetId?: string | null;
}): Promise<{
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  collapsed: boolean;
}> {
  const stripe = getStripe();
  const liveOther = await findLiveCustomerSubscription(
    opts.customerId,
    opts.incomingSubscriptionId
  );

  let canonical = await findCanonicalStripeBilling({
    userId: opts.userId,
    email: opts.email,
    excludeSubscriptionId: opts.incomingSubscriptionId,
  });

  // Prefer the oldest live Stripe subscription as the keeper. Never cancel
  // the original plan because a later duplicate's webhook fired first.
  let incomingCreated = Number.POSITIVE_INFINITY;
  try {
    const incoming = await stripe.subscriptions.retrieve(
      opts.incomingSubscriptionId
    );
    incomingCreated = incoming.created;
  } catch (error) {
    console.error("Failed to retrieve incoming subscription", error);
  }

  if (liveOther && liveOther.created < incomingCreated) {
    canonical = {
      stripeSubscriptionId: liveOther.id,
      stripeCustomerId:
        typeof liveOther.customer === "string"
          ? liveOther.customer
          : liveOther.customer.id,
      userId: opts.userId || canonical?.userId || null,
      email: opts.email.toLowerCase(),
    };
  } else if (canonical) {
    try {
      const keeper = await stripe.subscriptions.retrieve(
        canonical.stripeSubscriptionId
      );
      if (!(keeper.created < incomingCreated)) {
        return {
          stripeSubscriptionId: opts.incomingSubscriptionId,
          stripeCustomerId: opts.customerId,
          collapsed: false,
        };
      }
    } catch {
      /* keep supabase canonical if Stripe retrieve fails */
    }
  }

  if (!canonical || canonical.stripeSubscriptionId === opts.incomingSubscriptionId) {
    return {
      stripeSubscriptionId: opts.incomingSubscriptionId,
      stripeCustomerId: opts.customerId,
      collapsed: false,
    };
  }

  const supabase = createServerClient();

  if (opts.targetId) {
    const { data: existingRow } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("target_id", opts.targetId)
      .eq("email", opts.email.toLowerCase())
      .maybeSingle();

    const entitlement = {
      email: opts.email.toLowerCase(),
      stripe_customer_id: canonical.stripeCustomerId || opts.customerId,
      stripe_subscription_id: canonical.stripeSubscriptionId,
      user_id: opts.userId || canonical.userId,
      active: true,
      user_paused: false,
      updated_at: new Date().toISOString(),
    };

    if (existingRow) {
      await supabase.from("subscriptions").update(entitlement).eq("id", existingRow.id);
    } else {
      await supabase.from("subscriptions").insert({
        target_id: opts.targetId,
        ...entitlement,
      });
    }
  }

  try {
    await stripe.subscriptions.cancel(opts.incomingSubscriptionId, {
      invoice_now: false,
      prorate: true,
    });
  } catch (error) {
    console.error("Failed to cancel duplicate Stripe subscription", {
      incomingSubscriptionId: opts.incomingSubscriptionId,
      canonicalSubscriptionId: canonical.stripeSubscriptionId,
      error,
    });
  }

  return {
    stripeSubscriptionId: canonical.stripeSubscriptionId,
    stripeCustomerId: canonical.stripeCustomerId || opts.customerId,
    collapsed: true,
  };
}

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
