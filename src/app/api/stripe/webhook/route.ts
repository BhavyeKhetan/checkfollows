import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { enableMonitoring, disableMonitoring } from "@/lib/monitoring";
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
        const customerEmail =
          session.metadata?.email ||
          session.customer_details?.email ||
          session.customer_email;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const metadata = session.metadata || {};

        console.log("Checkout completed:", {
          sessionId: session.id,
          customerEmail,
          subscriptionId,
          metadata,
        });

        // A subscription-mode checkout should always have a subscription id.
        if (subscriptionId && customerEmail) {
          const supabase = createServerClient();

          // Upsert subscription (email can exist from a prior generic purchase).
          const { data: existing } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("email", customerEmail)
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();

          const plan = metadata.plan || "basic";
          const targetId = metadata.target_id || null;

          const subRow = {
            email: customerEmail,
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            active: true,
            updated_at: new Date().toISOString(),
            ...(targetId ? { target_id: targetId } : {}),
          };

          if (existing) {
            await supabase
              .from("subscriptions")
              .update(subRow)
              .eq("id", existing.id);
          } else {
            const { error: insertErr } = await supabase
              .from("subscriptions")
              .insert({
                email: customerEmail,
                plan,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                active: true,
                ...(targetId ? { target_id: targetId } : {}),
              });

            if (insertErr) {
              // Likely UNIQUE(target_id, email) — a re-purchase for the same
              // target+email. Update the existing row with the new Stripe ids,
              // but never overwrite a NEWER subscription that a late/retried
              // webhook would clobber.
              console.warn(
                "Subscription insert failed (likely re-purchase); updating instead:",
                insertErr.message
              );
              if (targetId) {
                const { data: conflicting } = await supabase
                  .from("subscriptions")
                  .select("stripe_subscription_id")
                  .eq("target_id", targetId)
                  .eq("email", customerEmail)
                  .maybeSingle();

                const existingSubId = conflicting?.stripe_subscription_id;
                if (
                  !existingSubId ||
                  existingSubId === subscriptionId ||
                  existingSubId === null
                ) {
                  await supabase
                    .from("subscriptions")
                    .update({
                      plan,
                      stripe_customer_id: customerId,
                      stripe_subscription_id: subscriptionId,
                      active: true,
                      user_paused: false,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("target_id", targetId)
                    .eq("email", customerEmail);
                }
              }
            }
          }

          // ─── THE FIX: paid = monitoring on ─────────────────
          // If this purchase is tied to a specific Instagram account,
          // enable monitoring immediately (next_scan_at = now). The baseline
          // itself is established synchronously by /api/stripe/activate when
          // the browser redirects back; the cron (which respects next_scan_at)
          // is the safety net if the user closes the browser early.
          if (targetId) {
            await enableMonitoring(targetId);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const isActive =
          subscription.status === "active" || subscription.status === "trialing";

        const supabase = createServerClient();

        // Sync active flag for all linked rows.
        const { data: linked } = await supabase
          .from("subscriptions")
          .select("id, target_id, user_paused")
          .eq("stripe_subscription_id", subscription.id);

        await supabase
          .from("subscriptions")
          .update({ active: isActive, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);

        // Reflect entitlement on the targets themselves. A user-initiated
        // pause (user_paused=true) must NOT be silently reverted by a
        // routine Stripe lifecycle event.
        for (const row of linked || []) {
          if (!row.target_id) continue;
          if (isActive && !row.user_paused) {
            await enableMonitoring(row.target_id);
          } else if (!isActive) {
            // Only disable when entitlement actually lapses.
            if (subscription.status === "canceled" || subscription.status === "unpaid") {
              await disableMonitoring(row.target_id);
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const supabase = createServerClient();

        const { data: linked } = await supabase
          .from("subscriptions")
          .select("target_id")
          .eq("stripe_subscription_id", subscription.id);

        await supabase
          .from("subscriptions")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);

        for (const row of linked || []) {
          if (row.target_id) await disableMonitoring(row.target_id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as unknown as Record<string, unknown>).subscription as string | undefined;
        console.log("Payment failed:", {
          invoiceId: invoice.id,
          subscriptionId: subId,
        });

        // Do NOT disable monitoring here: Stripe retries failed payments and
        // the plan is to disable only when entitlement actually lapses
        // (handled by customer.subscription.updated/deleted on canceled/unpaid).
        if (subId) {
          const supabase = createServerClient();
          await supabase
            .from("subscriptions")
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subId);
        }
        break;
      }

      case "radar.early_fraud_warning.created": {
        const efw = event.data.object as Stripe.Radar.EarlyFraudWarning;
        const chargeId = efw.charge as string;
        if (efw.actionable && chargeId) {
          try {
            await getStripe().refunds.create({ charge: chargeId });
            console.log("[Webhook] Refunded charge after early fraud warning:", chargeId);
          } catch (err) {
            console.error("[Webhook] EFW refund failed:", err);
          }
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = dispute.charge as string;
        if (chargeId) {
          try {
            await getStripe().refunds.create({ charge: chargeId });
            console.log("[Webhook] Refunded charge after dispute:", chargeId);
          } catch (err) {
            console.error("[Webhook] Dispute refund failed:", err);
          }
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
