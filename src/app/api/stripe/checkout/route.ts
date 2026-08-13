import { NextResponse } from "next/server";
import { getStripe, getStripePriceId, getEmailAlertsPriceId } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const stripe = getStripe();

    let cadence: "weekly" | "quarterly" = "weekly";
    let emailAlerts = false;
    const targetMeta: Record<string, string> = {};
    let customerEmail: string | undefined;

    try {
      const body = await request.json();
      if (body.cadence === "quarterly") cadence = "quarterly";
      if (body.email_alerts === true || body.email_alerts === "true") emailAlerts = true;
      if (body.username) targetMeta.username = String(body.username);
      if (body.targetId) targetMeta.target_id = String(body.targetId);
      if (typeof body.email === "string" && body.email.trim()) {
        customerEmail = String(body.email).trim();
        targetMeta.email = customerEmail;
      }
    } catch {
      // no body — default to weekly
    }

    const priceId = getStripePriceId(cadence);

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: priceId, quantity: 1 },
    ];
    if (emailAlerts) {
      lineItems.push({ price: getEmailAlertsPriceId(cadence), quantity: 1 });
    }

    // "pro" plan = email alerts enabled (add-on). "basic" = monitoring only.
    const plan = emailAlerts ? "pro" : "basic";
    const sharedMetadata = {
      product: "checkfollows",
      cadence,
      plan,
      email_alerts: String(emailAlerts),
      ...targetMeta,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/?canceled=true`,
      subscription_data: {
        trial_period_days: 7,
        metadata: sharedMetadata,
      },
      metadata: sharedMetadata,
    });

    return NextResponse.json({ url: session.url, cadence, emailAlerts });
  } catch (error: unknown) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
