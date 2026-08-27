import { NextResponse } from "next/server";
import {
  getStripe,
  getStripePriceId,
  getEmailAlertsPriceId,
  subscriptionClientSecret,
  type PlanTier,
} from "@/lib/stripe";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import {
  ALREADY_SUBSCRIBED_CODE,
  ALREADY_SUBSCRIBED_MESSAGE,
  findLiveCustomerSubscription,
  findReusableIncompleteSubscription,
} from "@/lib/subscription-management";
import {
  creatorAttributionToStripeMetadata,
  readCreatorAttributionCookie,
} from "@/lib/creator-link-attribution";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * POST /api/stripe/create-checkout
 * Body: { cadence: "weekly" | "quarterly", email_alerts?: boolean,
 *         email: string, username?: string, targetId?: string, relationship?: string }
 *
 * In-page (embedded) checkout. Creates a Stripe customer + an "incomplete"
 * subscription, then returns the first invoice's confirmation secret so the
 * Payment Element can collect the payment method without leaving the funnel.
 */
export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const body = await request.json().catch(() => ({}));

    const cadence: "weekly" | "quarterly" =
      body.cadence === "quarterly" ? "quarterly" : "weekly";
    const tier: PlanTier = body.tier === "premium" ? "premium" : "base";
    const emailAlerts =
      body.email_alerts === true || body.email_alerts === "true";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const username =
      typeof body.username === "string" ? body.username : undefined;
    const targetId = typeof body.targetId === "string" ? body.targetId : undefined;
    const relationship =
      typeof body.relationship === "string" ? body.relationship : undefined;

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }

    const plan = emailAlerts ? "pro" : "basic";
    const creatorAttributionMetadata = creatorAttributionToStripeMetadata(
      await readCreatorAttributionCookie()
    );

    const authUser = await getAuthUser();
    if (authUser && (await hasActiveSubscription(authUser.id))) {
      return NextResponse.json(
        {
          error: ALREADY_SUBSCRIBED_MESSAGE,
          code: ALREADY_SUBSCRIBED_CODE,
        },
        { status: 409 }
      );
    }

    // Reuse an existing customer for this email (idempotent re-entry).
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer = existingCustomers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        metadata: { product: "checkfollows", ...creatorAttributionMetadata },
      });
    } else if (Object.keys(creatorAttributionMetadata).length > 0) {
      customer = await stripe.customers.update(customer.id, {
        metadata: { ...customer.metadata, ...creatorAttributionMetadata },
      });
    }

    const items: Array<{ price: string }> = [
      { price: getStripePriceId(cadence, tier) },
    ];
    if (emailAlerts) {
      items.push({ price: getEmailAlertsPriceId(cadence) });
    }

    const metadata: Record<string, string> = {
      product: "checkfollows",
      cadence,
      tier,
      plan,
      email,
      email_alerts: String(emailAlerts),
      ...creatorAttributionMetadata,
    };
    if (username) metadata.username = username;
    if (targetId) metadata.target_id = targetId;
    if (relationship) metadata.relationship = relationship;

    // If the buyer is already signed in, tag the subscription so the webhook
    // can link it straight to their account (no signup step needed).
    if (authUser) metadata.user_id = authUser.id;

    const live = await findLiveCustomerSubscription(customer.id);
    if (live) {
      return NextResponse.json(
        {
          error: ALREADY_SUBSCRIBED_MESSAGE,
          code: ALREADY_SUBSCRIBED_CODE,
        },
        { status: 409 }
      );
    }

    const reusable = await findReusableIncompleteSubscription(
      customer.id,
      items.map((item) => item.price)
    );
    if (reusable) {
      let withSecret = reusable;
      if (
        !reusable.latest_invoice ||
        typeof reusable.latest_invoice === "string" ||
        !reusable.latest_invoice.confirmation_secret?.client_secret
      ) {
        withSecret = await stripe.subscriptions.retrieve(reusable.id, {
          expand: ["latest_invoice.confirmation_secret"],
        });
      }
      if (Object.keys(creatorAttributionMetadata).length > 0) {
        withSecret = await stripe.subscriptions.update(withSecret.id, {
          metadata: { ...withSecret.metadata, ...creatorAttributionMetadata },
          expand: ["latest_invoice.confirmation_secret"],
        });
      }
      return NextResponse.json({
        clientSecret: subscriptionClientSecret(withSecret),
        customerId: customer.id,
        subscriptionId: withSecret.id,
        cadence,
        tier,
        emailAlerts,
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata,
      expand: ["latest_invoice.confirmation_secret"],
    });

    return NextResponse.json({
      clientSecret: subscriptionClientSecret(subscription),
      customerId: customer.id,
      subscriptionId: subscription.id,
      cadence,
      tier,
      emailAlerts,
    });
  } catch (error) {
    console.error("Stripe create-checkout error:", error);
    return NextResponse.json(
      { error: "Failed to initialize checkout" },
      { status: 500 }
    );
  }
}
