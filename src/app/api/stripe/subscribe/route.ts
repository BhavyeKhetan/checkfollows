import { NextResponse } from "next/server";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import {
  getEmailAlertsPriceId,
  getStripe,
  getStripePriceId,
  type PlanTier,
} from "@/lib/stripe";
import {
  appReturnOrigin,
  getOwnedStripeSubscription,
  isManageableSubscription,
  type BillingCadence,
} from "@/lib/subscription-management";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    if (await hasActiveSubscription(user.id)) {
      return NextResponse.json(
        { error: "Your subscription is already active" },
        { status: 409 }
      );
    }
    const existing = await getOwnedStripeSubscription(user);
    if (existing && isManageableSubscription(existing.subscription)) {
      return NextResponse.json(
        {
          error:
            existing.subscription.status === "past_due" ||
            existing.subscription.status === "unpaid"
              ? "Update your payment method from the account page before starting another subscription."
              : "Your existing subscription can be managed from the account page.",
        },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const cadence: BillingCadence =
      body.cadence === "quarterly" ? "quarterly" : "weekly";
    const tier: PlanTier = body.tier === "premium" ? "premium" : "base";
    const emailAlerts = body.email_alerts === true;

    const supabase = createServerClient();
    const { data: prior } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const stripe = getStripe();
    let customerId = prior?.stripe_customer_id || "";
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = customers.data[0]?.id || "";
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { product: "checkfollows", user_id: user.id },
      });
      customerId = customer.id;
    } else {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && customer.metadata.user_id !== user.id) {
        await stripe.customers.update(customerId, {
          metadata: { ...customer.metadata, product: "checkfollows", user_id: user.id },
        });
      }
    }

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: getStripePriceId(cadence, tier), quantity: 1 },
    ];
    if (emailAlerts) {
      lineItems.push({ price: getEmailAlertsPriceId(cadence), quantity: 1 });
    }

    const metadata = {
      product: "checkfollows",
      source: "app_paywall",
      user_id: user.id,
      email: user.email.toLowerCase(),
      cadence,
      tier,
      plan: emailAlerts ? "pro" : "basic",
      email_alerts: String(emailAlerts),
    };
    const origin = appReturnOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: lineItems,
      success_url: `${origin}/dashboard?subscribed=1`,
      cancel_url: `${origin}/app/pricing?canceled=1`,
      metadata,
      subscription_data: { metadata },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("App subscription checkout error:", error);
    return NextResponse.json(
      { error: "Failed to start subscription checkout" },
      { status: 500 }
    );
  }
}
