import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

/** Base plan price IDs: weekly + quarterly billing cadences */
export const PRICE_IDS: Record<string, string> = {
  weekly: process.env.STRIPE_PRICE_WEEKLY_ID || "",
  quarterly: process.env.STRIPE_PRICE_QUARTERLY_ID || "",
};

/** Email-alerts upsell add-on price IDs (mirrors the base cadence). */
export const EMAIL_ALERTS_PRICE_IDS: Record<string, string> = {
  weekly: process.env.STRIPE_EMAIL_ALERTS_WEEKLY_ID || "",
  quarterly: process.env.STRIPE_EMAIL_ALERTS_QUARTERLY_ID || "",
};

export function getStripePriceId(cadence: "weekly" | "quarterly" = "weekly"): string {
  const id = PRICE_IDS[cadence];
  if (!id) throw new Error(`STRIPE_PRICE_${cadence.toUpperCase()}_ID is not configured`);
  return id;
}

export function getEmailAlertsPriceId(cadence: "weekly" | "quarterly"): string {
  const id = EMAIL_ALERTS_PRICE_IDS[cadence];
  if (!id) throw new Error(`STRIPE_EMAIL_ALERTS_${cadence.toUpperCase()}_ID is not configured`);
  return id;
}

export function getStripeRedirectUrl(sessionId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/?session_id=${sessionId}`;
}
