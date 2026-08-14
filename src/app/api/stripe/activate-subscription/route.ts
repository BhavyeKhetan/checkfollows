import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import {
  enableMonitoring,
  fullBaselineScan,
  getLatestSnapshot,
  getEventsForTarget,
} from "@/lib/monitoring";

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

    // Establish baseline only if none exists and no scan is running.
    let baseline: Awaited<ReturnType<typeof fullBaselineScan>> | null = null;
    if (targetId && username) {
      const existingSnapshot = await getLatestSnapshot(targetId, "following");
      const { data: runningScan } = await supabase
        .from("scans")
        .select("id")
        .eq("target_id", targetId)
        .eq("status", "running")
        .limit(1)
        .maybeSingle();

      if (!existingSnapshot && !runningScan) {
        try {
          baseline = await fullBaselineScan(username);
        } catch (err) {
          console.error("activate-subscription: baseline scan failed:", err);
        }
      }
    }

    let events: unknown[] = [];
    if (targetId) {
      events = await getEventsForTarget(targetId, {
        limit: 50,
        confirmedOnly: true,
      });
    }

    return NextResponse.json({
      success: true,
      activated: true,
      targetId,
      username,
      baselineEstablished: !!baseline,
      followingCount: baseline?.following.length ?? null,
      events,
    });
  } catch (error) {
    console.error("Stripe activate-subscription error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to activate subscription" },
      { status: 500 }
    );
  }
}
