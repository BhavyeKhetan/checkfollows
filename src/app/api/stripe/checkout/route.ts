import { NextResponse } from "next/server";
import { stripe, SUBSCRIPTION_PRICE_ID } from "@/lib/stripe";

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: SUBSCRIPTION_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/?canceled=true`,
      metadata: { product: "checkfollows_weekly" },
    });

    return NextResponse.redirect(session.url || baseUrl, 303);
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
