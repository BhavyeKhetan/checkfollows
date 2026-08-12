import { NextResponse } from "next/server";
import { getStripe, getStripePriceId } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const stripe = getStripe();

    let cadence: "weekly" | "quarterly" = "weekly";
    let targetMeta: Record<string, string> = {};

    try {
      const body = await request.json();
      if (body.cadence === "quarterly") cadence = "quarterly";
      if (body.username) targetMeta.username = body.username;
      if (body.targetId) targetMeta.target_id = body.targetId;
    } catch {
      // no body — default to weekly
    }

    const priceId = getStripePriceId(cadence);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/?canceled=true`,
      subscription_data: {
        trial_period_days: 7,
      },
      metadata: {
        product: "checkfollows",
        cadence,
        ...targetMeta,
      },
    });

    return NextResponse.json({ url: session.url, cadence });
  } catch (error: unknown) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
