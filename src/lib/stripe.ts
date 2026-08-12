import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, {
      typescript: true,
    });
  }
  return _stripe;
}

/** Price IDs for each plan tier */
export const PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC_ID || process.env.STRIPE_PRICE_ID || "",
  pro: process.env.STRIPE_PRICE_PRO_ID || "",
};

export function getStripePriceId(plan: "basic" | "pro" = "basic"): string {
  const id = PRICE_IDS[plan];
  if (!id) throw new Error(`STRIPE_PRICE_${plan.toUpperCase()}_ID is not configured`);
  return id;
}

export const WEEKLY_PRICE = 12.99;

export function getStripeRedirectUrl(sessionId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/?session_id=${sessionId}`;
}
