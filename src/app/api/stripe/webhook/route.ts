import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_details?.email;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        console.log("Checkout completed:", {
          sessionId: session.id,
          customerEmail,
          subscriptionId,
          metadata: session.metadata,
        });

        // Store subscription in Supabase if we have a target_id
        if (session.metadata?.target_id && customerEmail) {
          const supabase = createServerClient();

          const { error: subError } = await supabase
            .from("subscriptions")
            .insert({
              target_id: session.metadata.target_id,
              email: customerEmail,
              plan: "weekly",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              active: true,
            });

          if (subError) {
            console.error("Failed to store subscription:", subError);
          } else {
            console.log("Subscription stored for target:", session.metadata.target_id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription canceled:", subscription.id);

        const supabase = createServerClient();
        await supabase
          .from("subscriptions")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const isActive = subscription.status === "active" || subscription.status === "trialing";

        const supabase = createServerClient();
        await supabase
          .from("subscriptions")
          .update({
            active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as unknown as Record<string, unknown>).subscription as string | undefined;
        console.log("Payment failed:", {
          invoiceId: invoice.id,
          subscriptionId: subId,
        });

        if (subId) {
          const supabase = createServerClient();
          await supabase
            .from("subscriptions")
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subId);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
