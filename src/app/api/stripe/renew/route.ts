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
  getOwnedStripeSubscription,
  isManageableSubscription,
} from "@/lib/subscription-management";

const ALLOWED_RETURN_ORIGINS = new Set([
  "https://www.checkfollows.com",
  "https://checkfollows.com",
  "https://app.checkfollows.com",
  "http://localhost:3000",
]);

function returnOrigin(request: Request): string {
  const origin = new URL(request.url).origin;
  return ALLOWED_RETURN_ORIGINS.has(origin)
    ? origin
    : "https://www.checkfollows.com";
}

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
        { error: "Your existing subscription must be managed from your account." },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const cadence: "weekly" | "quarterly" =
      body.cadence === "quarterly" ? "quarterly" : "weekly";
    const tier: PlanTier = body.tier === "premium" ? "premium" : "base";
    const emailAlerts = body.email_alerts === true;
    const offer = body.offer === "winback_50" ? "winback_50" : "standard";

    const supabase = createServerClient();
    let { data: prior } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .not("stripe_subscription_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prior) {
      const byEmail = await supabase
        .from("subscriptions")
        .select("stripe_customer_id, stripe_subscription_id")
        .eq("email", user.email.toLowerCase())
        .not("stripe_subscription_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      prior = byEmail.data;
    }

    if (!prior?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No previous subscription was found" },
        { status: 403 }
      );
    }

    const stripe = getStripe();
    let customerId = prior.stripe_customer_id || "";
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
    }

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: getStripePriceId(cadence, tier), quantity: 1 },
    ];
    if (emailAlerts) {
      lineItems.push({ price: getEmailAlertsPriceId(cadence), quantity: 1 });
    }

    const metadata: Record<string, string> = {
      product: "checkfollows",
      reactivation: "true",
      renewal_offer: offer,
      user_id: user.id,
      email: user.email.toLowerCase(),
      cadence,
      tier,
      plan: emailAlerts ? "pro" : "basic",
      email_alerts: String(emailAlerts),
    };

    let promotionCodeId: string | undefined;
    if (offer === "winback_50") {
      const couponId = process.env.STRIPE_RENEWAL_50_COUPON_ID || "";
      if (!couponId) {
        return NextResponse.json(
          { error: "The renewal offer is temporarily unavailable" },
          { status: 503 }
        );
      }

      try {
        const coupon = await stripe.coupons.retrieve(couponId);
        if (
          coupon.deleted ||
          coupon.percent_off !== 50 ||
          coupon.duration !== "once" ||
          !coupon.valid
        ) {
          throw new Error("Renewal coupon configuration is invalid");
        }
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        if (statusCode !== 404) throw error;
        await stripe.coupons.create({
          id: couponId,
          percent_off: 50,
          duration: "once",
          name: "50% off first renewal billing cycle",
          metadata: {
            product: "checkfollows",
            purpose: "expired_subscriber_winback",
          },
        });
      }

      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      const existingPromotionId =
        customer.metadata.checkfollows_winback_promotion_code_id || "";
      if (existingPromotionId) {
        const existingPromotion = await stripe.promotionCodes.retrieve(
          existingPromotionId
        );
        if (
          !existingPromotion.active ||
          existingPromotion.times_redeemed >= 1
        ) {
          return NextResponse.json(
            { error: "This renewal offer has already been used" },
            { status: 409 }
          );
        }
        promotionCodeId = existingPromotion.id;
      } else {
        const promotion = await stripe.promotionCodes.create({
          promotion: { type: "coupon", coupon: couponId },
          customer: customerId,
          max_redemptions: 1,
          metadata: { product: "checkfollows", user_id: user.id },
        });
        promotionCodeId = promotion.id;
        await stripe.customers.update(customerId, {
          metadata: {
            checkfollows_winback_promotion_code_id: promotion.id,
          },
        });
      }
    }

    const baseUrl = returnOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: lineItems,
      success_url: `${baseUrl}/account?renewed=1`,
      cancel_url: `${baseUrl}/account?renewal_canceled=1`,
      metadata,
      subscription_data: { metadata },
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : {}),
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      offer,
      cadence,
      tier,
    });
  } catch (error) {
    console.error("Renewal checkout error:", error);
    return NextResponse.json(
      { error: "Failed to start renewal checkout" },
      { status: 500 }
    );
  }
}
