import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { enableMonitoring } from "@/lib/monitoring";
import { collapseDuplicateStripeSubscription } from "@/lib/subscription-management";

/**
 * POST /api/stripe/activate-subscription
 * Body: { subscription_id, email?, username?, target_id? }
 *
 * Called by the frontend after an in-page (embedded) Stripe payment succeeds.
 * Verifies the subscription is active, upserts the subscription row, enables
 * monitoring for the linked target, and establishes the baseline snapshot if
 * one doesn't already exist. Idempotent.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const subscriptionId =
      typeof body.subscription_id === "string" ? body.subscription_id : "";
    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: "subscription_id is required" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const isActive =
      subscription.status === "active" || subscription.status === "trialing";
    if (!isActive) {
      return NextResponse.json(
        { success: false, error: "Subscription is not active yet" },
        { status: 402 }
      );
    }

    const metadata = subscription.metadata || {};
    const customerId = (subscription.customer as string) || "";
    const plan = metadata.plan || "basic";
    const targetId = metadata.target_id || body.target_id || null;
    const username = metadata.username || body.username || null;

    let customerEmail =
      metadata.email || (typeof body.email === "string" ? body.email : "") || "";
    if (!customerEmail && customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.email) customerEmail = customer.email;
      } catch {
        /* ignore */
      }
    }

    const supabase = createServerClient();

    const collapsed = await collapseDuplicateStripeSubscription({
      incomingSubscriptionId: subscriptionId,
      customerId,
      email: customerEmail,
      userId: metadata.user_id || null,
      targetId,
    });
    if (collapsed.collapsed) {
      if (targetId) await enableMonitoring(targetId);
      return NextResponse.json({
        success: true,
        alreadySubscribed: true,
        username,
      });
    }

    // Upsert subscription row (same idempotent logic as the webhook).
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    const subData = {
      email: customerEmail,
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      active: true,
      user_paused: false,
      ...(targetId ? { target_id: targetId } : {}),
    };

    if (existing) {
      await supabase
        .from("subscriptions")
        .update({ ...subData, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      const { error: insertErr } = await supabase
        .from("subscriptions")
        .insert(subData);

      if (insertErr && targetId && customerEmail) {
        // UNIQUE(target_id, email) — a re-purchase. Update the existing row,
        // but never clobber a newer subscription from a late webhook.
        console.warn(
          "activate-subscription: insert failed (likely re-purchase); updating instead:",
          insertErr.message
        );
        const { data: conflicting } = await supabase
          .from("subscriptions")
          .select("stripe_subscription_id")
          .eq("target_id", targetId)
          .eq("email", customerEmail)
          .maybeSingle();

        const existingSubId = conflicting?.stripe_subscription_id;
        if (!existingSubId || existingSubId === subscriptionId) {
          await supabase
            .from("subscriptions")
            .update({ ...subData, updated_at: new Date().toISOString() })
            .eq("target_id", targetId)
            .eq("email", customerEmail);
        }
      } else if (insertErr) {
        console.error("activate-subscription: failed to store subscription:", insertErr);
      }
    }

    // Enable monitoring for the linked target.
    if (targetId) {
      await enableMonitoring(targetId);
    }

    // Establish the baseline in the BACKGROUND. The full-following Apify scan
    // can take minutes; awaiting it here leaves the buyer stuck on
    // "Processing..." after their card already succeeded. The hourly monitor
    // cron is the authoritative path: it atomically claims this target
    // (next_scan_at is already "now" via enableMonitoring above) and
    // establishes the baseline + diffs on its next run. We also nudge that
    // same cron to run immediately, best-effort, so the first scan starts
    // right away without blocking this response.
    try {
      if (targetId && process.env.CRON_SECRET) {
        const baseUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          request.headers.get("origin") ||
          "https://www.checkfollows.com";
        fetch(
          `${baseUrl}/api/cron/monitor?secret=${encodeURIComponent(
            process.env.CRON_SECRET
          )}`,
          { method: "POST" }
        ).catch(() => {
          /* best-effort */
        });
      }
    } catch {
      /* best-effort */
    }

    return NextResponse.json({
      success: true,
      activated: true,
      targetId,
      username,
      baselineEstablished: false,
      followingCount: null,
    });
  } catch (error) {
    console.error("Stripe activate-subscription error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to activate subscription" },
      { status: 500 }
    );
  }
}
