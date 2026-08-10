import Stripe from "stripe";

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "",
  {
    apiVersion: "2025-06-16.basil" as any,
    typescript: true,
  }
);

export const SUBSCRIPTION_PRICE_ID =
  process.env.STRIPE_PRICE_ID || "price_placeholder";

export const WEEKLY_PRICE = 12.99;

export function getStripeRedirectUrl(sessionId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/?session_id=${sessionId}`;
}
