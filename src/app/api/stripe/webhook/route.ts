import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import {
  disableMonitoringIfUnused,
  enableMonitoring,
} from "@/lib/monitoring";
import { ensureFreePlanCredits } from "@/lib/purchases";
import { trackServer } from "@/lib/mixpanel-server";
import { collapseDuplicateStripeSubscription } from "@/lib/subscription-management";
import type Stripe from "stripe";

/**
 * Fire a server-side Mixpanel lifecycle event for a subscription, resolving
 * identity (user UUID → email) and plan/tier/cadence best-effort. Never
 * throws — analytics must not break webhook handling.
 */
async function fireLifecycle(
  subscriptionId: string,
  eventName: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("email, user_id, plan, tier")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    let cadence: string | undefined;
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      cadence = sub.metadata?.cadence || undefined;
    } catch {
      /* ignore */
    }

    trackServer(eventName, {
      ...(data?.user_id ? { user_id: data.user_id as string } : {}),
      ...(data?.email ? { email: data.email as string } : {}),
      ...(data?.plan ? { plan: data.plan as string } : {}),
      ...(data?.tier ? { tier: data.tier as string } : {}),
      ...(cadence ? { cadence } : {}),
      subscription_id: subscriptionId,
      ...extra,
    });
  } catch (err) {
    console.error("[mixpanel] lifecycle tracking failed:", err);
  }
}

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

        // ─── One-time upsell purchases (export / rescan / mutuals) ───
        if (session.mode === "payment" && metadata.kind) {
          const otpUserId = metadata.user_id || null;
          if (otpUserId) {
            const quantity = parseInt(metadata.credits || metadata.quantity || "1", 10) || 1;
            await createServerClient().from("one_time_purchases").insert({
              user_id: otpUserId,
              kind: metadata.kind,
              target_id: metadata.target_id || null,
              credits: quantity,
              consumed: 0,
              stripe_session_id: session.id,
            });
            console.log("One-time purchase credited:", {
              userId: otpUserId,
              kind: metadata.kind,
              credits: quantity,
              bundle: metadata.bundle || null,
            });
            trackServer("one_time_purchase_completed", {
              user_id: otpUserId,
              ...(customerEmail ? { email: customerEmail } : {}),
              kind: metadata.kind,
              quantity: quantity,
              ...(metadata.bundle ? { bundle: metadata.bundle } : {}),
            });
          }
          break;
        }

        console.log("Checkout completed:", {
          sessionId: session.id,
          customerEmail,
          subscriptionId,
          metadata,
        });

        // A subscription-mode checkout should always have a subscription id.
        if (subscriptionId && customerEmail) {
          const supabase = createServerClient();

          if (metadata.reactivation !== "true") {
            const collapsed = await collapseDuplicateStripeSubscription({
              incomingSubscriptionId: subscriptionId,
              customerId,
              email: customerEmail,
              userId: metadata.user_id || null,
              targetId: metadata.target_id || null,
            });
            if (collapsed.collapsed) {
              if (metadata.target_id) {
                await enableMonitoring(metadata.target_id);
              }
              console.warn("Webhook: canceled duplicate Stripe subscription", {
                incoming: subscriptionId,
                canonical: collapsed.stripeSubscriptionId,
              });
              break;
            }
          }

          // Upsert subscription (email can exist from a prior generic purchase).
          const { data: existing } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("email", customerEmail)
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();

          const plan = metadata.plan || "basic";
          const tier = metadata.tier || "base";
          const targetId = metadata.target_id || null;
          const userId = metadata.user_id || null;

          const subRow = {
            email: customerEmail,
            plan,
            tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            active: true,
            updated_at: new Date().toISOString(),
            ...(targetId ? { target_id: targetId } : {}),
            ...(userId ? { user_id: userId } : {}),
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
                tier,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                active: true,
                ...(targetId ? { target_id: targetId } : {}),
                ...(userId ? { user_id: userId } : {}),
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
                      tier,
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

          if (userId) {
            await ensureFreePlanCredits(userId);
          }

          // Renewal checkouts are generic subscriptions. Reattach the new
          // Stripe subscription to every historical target owned by this user
          // and resume monitoring only after Stripe confirms checkout.
          if (metadata.reactivation === "true" && userId) {
            const { data: historicalRows } = await supabase
              .from("subscriptions")
              .select("id, target_id")
              .eq("user_id", userId)
              .not("target_id", "is", null);

            for (const row of historicalRows || []) {
              await supabase
                .from("subscriptions")
                .update({
                  plan,
                  tier,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  active: true,
                  user_paused: false,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", row.id);
              if (row.target_id) await enableMonitoring(row.target_id);
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const isActive =
          subscription.status === "active" || subscription.status === "trialing";
        const metadata = subscription.metadata || {};
        const email = metadata.email || "";
        const plan = metadata.plan || "basic";
        const tier = metadata.tier || "base";
        const targetId = metadata.target_id || null;
        const userId = metadata.user_id || null;

        // Churn signal: the user scheduled cancellation at period end.
        const prev = (event.data.previous_attributes || {}) as Record<
          string,
          unknown
        >;
        if (
          subscription.cancel_at_period_end === true &&
          prev.cancel_at_period_end !== true
        ) {
          await fireLifecycle(subscription.id, "subscription_cancel_scheduled", {
            cancel_at_period_end: true,
          });
        }

        const supabase = createServerClient();

        if (email && isActive) {
          const collapsed = await collapseDuplicateStripeSubscription({
            incomingSubscriptionId: subscription.id,
            customerId: (subscription.customer as string) || "",
            email,
            userId,
            targetId,
          });
          if (collapsed.collapsed) {
            if (targetId) await enableMonitoring(targetId);
            console.warn("Webhook: canceled duplicate Stripe subscription", {
              incoming: subscription.id,
              canonical: collapsed.stripeSubscriptionId,
            });
            break;
          }
        }

        // Upsert the subscription row. Embedded (Payment Element) checkouts
        // create the subscription via the API, so there is no
        // checkout.session.completed event to insert it — insert here.
        if (email) {
          const { data: existingRow } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          const base = {
            email,
            plan,
            tier,
            stripe_customer_id: (subscription.customer as string) || null,
            stripe_subscription_id: subscription.id,
            active: isActive,
            updated_at: new Date().toISOString(),
            ...(targetId ? { target_id: targetId } : {}),
            ...(userId ? { user_id: userId } : {}),
          };

          if (existingRow) {
            await supabase
              .from("subscriptions")
              .update(base)
              .eq("id", existingRow.id);
          } else {
            const { error: insertErr } = await supabase
              .from("subscriptions")
              .insert(base);

            if (insertErr && targetId) {
              // UNIQUE(target_id, email) — a re-purchase. Update the existing
              // row, but never clobber a newer subscription.
              console.warn(
                "Webhook: subscription insert failed (re-purchase); updating instead:",
                insertErr.message
              );
              const { data: conflicting } = await supabase
                .from("subscriptions")
                .select("stripe_subscription_id")
                .eq("target_id", targetId)
                .eq("email", email)
                .maybeSingle();

              const existingSubId = conflicting?.stripe_subscription_id;
              if (
                !existingSubId ||
                existingSubId === subscription.id ||
                existingSubId === null
              ) {
                await supabase
                  .from("subscriptions")
                  .update(base)
                  .eq("target_id", targetId)
                  .eq("email", email);
              }
            } else if (insertErr) {
              console.warn("Webhook: subscription upsert failed:", insertErr.message);
            }
          }
        }

        // Reflect entitlement on the targets themselves. A user-initiated
        // pause (user_paused=true) must NOT be silently reverted by a
        // routine Stripe lifecycle event.
        const { data: linked } = await supabase
          .from("subscriptions")
          .select("id, target_id, user_paused")
          .eq("stripe_subscription_id", subscription.id);

        for (const row of linked || []) {
          if (!row.target_id) continue;
          if (isActive && !row.user_paused) {
            await enableMonitoring(row.target_id);
          } else if (!isActive) {
            // Only disable when entitlement actually lapses.
            if (subscription.status === "canceled" || subscription.status === "unpaid") {
              await disableMonitoringIfUnused(row.target_id);
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
          if (row.target_id) await disableMonitoringIfUnused(row.target_id);
        }

        await fireLifecycle(subscription.id, "subscription_canceled", {});
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const paidSubId = (invoice as unknown as Record<string, unknown>)
          .subscription as string | undefined;
        if (paidSubId) {
          if (invoice.billing_reason === "subscription_cycle") {
            await fireLifecycle(paidSubId, "subscription_renewed", {
              amount_paid: invoice.amount_paid,
              billing_reason: invoice.billing_reason,
            });
          } else if (invoice.billing_reason === "subscription_create") {
            await fireLifecycle(paidSubId, "subscription_created", {
              amount_paid: invoice.amount_paid,
              billing_reason: invoice.billing_reason,
            });
          }
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
          await fireLifecycle(subId, "payment_failed", {});
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
          trackServer("fraud_warning_created", {
            charge_id: chargeId,
            actionable: true,
          });
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
          trackServer("dispute_created", { charge_id: chargeId });
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
