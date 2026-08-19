import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAuthUser } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import {
  EMAIL_ALERTS_PRICE_IDS,
  PREMIUM_PRICE_IDS,
  PRICE_IDS,
  getEmailAlertsPriceId,
  getStripe,
  getStripePriceId,
  type PlanTier,
} from "@/lib/stripe";
import { trackServer } from "@/lib/mixpanel-server";
import {
  getOwnedStripeSubscription,
  isManageableSubscription,
  subscriptionPeriodEnd,
  type BillingCadence,
} from "@/lib/subscription-management";

const CANCEL_REASONS = new Set([
  "too_expensive",
  "not_using_enough",
  "missing_features",
  "technical_issues",
  "tracking_someone_else",
  "privacy_concerns",
  "other",
]);

async function ensureRetentionCoupon(): Promise<string> {
  const stripe = getStripe();
  const couponId =
    process.env.STRIPE_RETENTION_50_COUPON_ID ||
    "checkfollows_retention_50_next_cycle";
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    if (
      coupon.deleted ||
      coupon.percent_off !== 50 ||
      coupon.duration !== "once" ||
      !coupon.valid
    ) {
      throw new Error("Retention coupon configuration is invalid");
    }
    return coupon.id;
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
    if (statusCode !== 404) throw error;
    const coupon = await stripe.coupons.create({
      id: couponId,
      percent_off: 50,
      duration: "once",
      name: "50% off next CheckFollows billing cycle",
      metadata: { product: "checkfollows", purpose: "cancel_retention" },
    });
    return coupon.id;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    const owned = await getOwnedStripeSubscription(user);
    if (!owned || !isManageableSubscription(owned.subscription)) {
      return NextResponse.json(
        { error: "No manageable subscription was found" },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    const { subscription, customerId } = owned;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return NextResponse.json({ error: "Billing customer not found" }, { status: 404 });
    }

    if (action === "cancel") {
      const reason = CANCEL_REASONS.has(body.reason) ? body.reason : "other";
      const note =
        typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
      const updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        metadata: {
          ...subscription.metadata,
          cancel_reason: reason,
          cancel_note: note,
          cancellation_requested_by: user.id,
        },
      });
      trackServer("cancellation_requested", {
        user_id: user.id,
        reason,
        cadence: subscription.metadata.cadence,
        tier: subscription.metadata.tier,
      });
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        currentPeriodEnd: new Date(
          subscriptionPeriodEnd(updated) * 1000
        ).toISOString(),
      });
    }

    if (action === "reactivate") {
      const updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
        metadata: {
          ...subscription.metadata,
          cancellation_reversed_by: user.id,
        },
      });
      trackServer("subscription_reactivated", { user_id: user.id });
      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
      });
    }

    if (action === "pause_month") {
      if (customer.metadata.checkfollows_pause_month_used === "true") {
        return NextResponse.json(
          { error: "The one-month billing break has already been used" },
          { status: 409 }
        );
      }
      const resumesAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
        pause_collection: { behavior: "void", resumes_at: resumesAt },
        metadata: {
          ...subscription.metadata,
          retention_action: "pause_month",
          pause_resumes_at: String(resumesAt),
        },
      });
      await stripe.customers.update(customerId, {
        metadata: {
          ...customer.metadata,
          checkfollows_pause_month_used: "true",
        },
      });
      trackServer("cancellation_pause_accepted", {
        user_id: user.id,
        resumes_at: resumesAt,
      });
      return NextResponse.json({
        success: true,
        pauseResumesAt: new Date(resumesAt * 1000).toISOString(),
      });
    }

    if (action === "apply_discount") {
      if (customer.metadata.checkfollows_retention_50_used === "true") {
        return NextResponse.json(
          { error: "The retention discount has already been used" },
          { status: 409 }
        );
      }
      if (subscription.discounts.length > 0) {
        return NextResponse.json(
          { error: "A discount is already active on this subscription" },
          { status: 409 }
        );
      }
      const couponId = await ensureRetentionCoupon();
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
        discounts: [{ coupon: couponId }],
        metadata: {
          ...subscription.metadata,
          retention_action: "50_percent_next_cycle",
        },
      });
      await stripe.customers.update(customerId, {
        metadata: {
          ...customer.metadata,
          checkfollows_retention_50_used: "true",
        },
      });
      trackServer("cancellation_discount_accepted", {
        user_id: user.id,
        percent_off: 50,
      });
      return NextResponse.json({ success: true, percentOff: 50 });
    }

    if (action === "change_plan") {
      if (subscription.status !== "active" && subscription.status !== "trialing") {
        return NextResponse.json(
          { error: "Resolve the billing issue before changing plans" },
          { status: 409 }
        );
      }
      const cadence: BillingCadence =
        body.cadence === "quarterly" ? "quarterly" : "weekly";
      const tier: PlanTier = body.tier === "premium" ? "premium" : "base";
      const emailAlerts = body.email_alerts === true;

      const basePriceIds = new Set(
        [...Object.values(PRICE_IDS), ...Object.values(PREMIUM_PRICE_IDS)].filter(Boolean)
      );
      const alertPriceIds = new Set(Object.values(EMAIL_ALERTS_PRICE_IDS).filter(Boolean));
      const baseItem = subscription.items.data.find((item) =>
        basePriceIds.has(item.price.id)
      );
      const alertItem = subscription.items.data.find((item) =>
        alertPriceIds.has(item.price.id)
      );
      if (!baseItem) {
        return NextResponse.json(
          { error: "The current subscription plan could not be identified" },
          { status: 409 }
        );
      }

      const items: Stripe.SubscriptionUpdateParams.Item[] = [
        {
          id: baseItem.id,
          price: getStripePriceId(cadence, tier),
          quantity: 1,
        },
      ];
      if (emailAlerts) {
        items.push({
          ...(alertItem ? { id: alertItem.id } : {}),
          price: getEmailAlertsPriceId(cadence),
          quantity: 1,
        });
      } else if (alertItem) {
        items.push({ id: alertItem.id, deleted: true });
      }

      const plan = emailAlerts ? "pro" : "basic";
      const updated = await stripe.subscriptions.update(subscription.id, {
        items,
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
        metadata: {
          ...subscription.metadata,
          cadence,
          tier,
          plan,
          email_alerts: String(emailAlerts),
          plan_changed_by: user.id,
        },
      });

      await createServerClient()
        .from("subscriptions")
        .update({
          tier,
          plan,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id)
        .eq("user_id", user.id);

      trackServer("subscription_plan_changed", {
        user_id: user.id,
        cadence,
        tier,
        email_alerts: emailAlerts,
      });
      return NextResponse.json({
        success: true,
        status: updated.status,
        cadence,
        tier,
        emailAlerts,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("Subscription management error:", error);
    return NextResponse.json(
      {
        error:
          "The subscription could not be updated. Check your payment method and try again.",
      },
      { status: 500 }
    );
  }
}
