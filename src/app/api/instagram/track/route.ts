import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enableMonitoring, disableMonitoring } from "@/lib/monitoring";
import { getStripe, getStripePriceId } from "@/lib/stripe";

const MAX_TRACKED = parseInt(
  process.env.MAX_TRACKED_ACCOUNTS_PER_USER || "5",
  10
);

/**
 * Track Changes endpoint.
 *
 * GATES monitoring behind a Stripe subscription:
 *   - Already has an ACTIVE paid subscription for this target+email  → enable monitoring (idempotent).
 *   - Email has an ACTIVE paid subscription for a different target   → attach this target (no new charge, up to cap).
 *   - No paid subscription at all                                    → create a Stripe Checkout session, return { url }.
 *
 * action=stop disables monitoring for the target (user-initiated stop).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetId, email, action = "start" } = body;

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: "targetId is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // ─── STOP: disable monitoring + mark user-paused ──
    // user_paused = true prevents Stripe lifecycle events from silently
    // re-enabling this account later (see webhook handler).
    if (action === "stop") {
      await disableMonitoring(targetId);

      let q = supabase
        .from("subscriptions")
        .update({
          user_paused: true,
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("target_id", targetId);
      if (email) q = q.eq("email", email);
      await q;

      return NextResponse.json({
        success: true,
        message: "Monitoring stopped for this account",
      });
    }

    // ─── START ────────────────────────────────────────────────
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "A valid email is required to start tracking" },
        { status: 400 }
      );
    }

    const { data: target } = await supabase
      .from("instagram_targets")
      .select("id, username, monitoring_enabled")
      .eq("id", targetId)
      .single();

    if (!target) {
      return NextResponse.json(
        { success: false, error: "Target not found" },
        { status: 404 }
      );
    }

    // 1) Already tracking this exact target on this email (paid)?
    //    Include paused rows: a user who stopped then restarts still holds a
    //    paid entitlement and must not be sent back through checkout.
    const { data: existingPaid } = await supabase
      .from("subscriptions")
      .select("id, plan")
      .eq("target_id", targetId)
      .eq("email", email)
      .or("active.eq.true,user_paused.eq.true")
      .not("stripe_subscription_id", "is", null)
      .maybeSingle();

    if (existingPaid) {
      // Clear the user-pause flag so webhook events can manage it again.
      await supabase
        .from("subscriptions")
        .update({ user_paused: false, active: true, updated_at: new Date().toISOString() })
        .eq("id", existingPaid.id);
      if (!target.monitoring_enabled) await enableMonitoring(targetId);
      return NextResponse.json({
        success: true,
        alreadySubscribed: true,
        message: `Now tracking @${target.username} — monitoring is active`,
      });
    }

    // 2) Email has a Stripe-backed paid sub for a DIFFERENT target (or generic)?
    //    Attach this target to their existing subscription — no new charge.
    //    user_paused rows still represent a paid entitlement (the user paused
    //    monitoring but the Stripe subscription is still active), so include
    //    them and clear the pause flag on restart.
    const { data: paidSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, plan")
      .eq("email", email)
      .or("active.eq.true,user_paused.eq.true")
      .not("stripe_subscription_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (paidSub) {
      const { count } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("email", email)
        .eq("active", true)
        .not("target_id", "is", null);

      if (count !== null && count >= MAX_TRACKED) {
        return NextResponse.json(
          {
            success: false,
            error: `You're tracking ${count} accounts already — the limit is ${MAX_TRACKED}. Upgrade to track more.`,
            atLimit: true,
            currentCount: count,
            maxAllowed: MAX_TRACKED,
          },
          { status: 402 }
        );
      }

      // Reuse the existing row if one exists (UNIQUE target_id+email), else insert.
      const { data: existingRow } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("target_id", targetId)
        .eq("email", email)
        .maybeSingle();

      if (existingRow) {
        await supabase
          .from("subscriptions")
          .update({
            plan: paidSub.plan || "pro",
            stripe_customer_id: paidSub.stripe_customer_id,
            stripe_subscription_id: paidSub.stripe_subscription_id,
            active: true,
            user_paused: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRow.id);
      } else {
        const { error: insertErr } = await supabase
          .from("subscriptions")
          .insert({
            target_id: targetId,
            email,
            plan: paidSub.plan || "pro",
            stripe_customer_id: paidSub.stripe_customer_id,
            stripe_subscription_id: paidSub.stripe_subscription_id,
            active: true,
            user_paused: false,
          });
        if (insertErr) {
          console.error("Attach subscription insert error:", insertErr);
          return NextResponse.json(
            { success: false, error: "Failed to attach account to subscription" },
            { status: 500 }
          );
        }
      }

      await enableMonitoring(targetId);

      return NextResponse.json({
        success: true,
        attachedToExistingSubscription: true,
        message: `@${target.username} added to your subscription — monitoring is active`,
      });
    }

    // 3) No paid sub → cap check + route through Stripe Checkout
    const { count } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .eq("active", true)
      .not("target_id", "is", null);

    if (count !== null && count >= MAX_TRACKED) {
      return NextResponse.json(
        {
          success: false,
          error: `You're tracking ${count} accounts already — the limit is ${MAX_TRACKED}. Upgrade to track more.`,
          atLimit: true,
          currentCount: count,
          maxAllowed: MAX_TRACKED,
        },
        { status: 402 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const stripe = getStripe();
    const priceId = getStripePriceId("weekly");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${baseUrl}/track/${encodeURIComponent(
        target.username
      )}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/track/${encodeURIComponent(
        target.username
      )}?canceled=true`,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          product: "checkfollows",
          cadence: "weekly",
          target_id: targetId,
          username: target.username,
          email,
          plan: "pro",
        },
      },
      metadata: {
        product: "checkfollows",
        cadence: "weekly",
        target_id: targetId,
        username: target.username,
        email,
        plan: "pro",
      },
    });

    return NextResponse.json({
      success: true,
      checkout: true,
      url: session.url,
      message: "Complete payment to start tracking",
    });
  } catch (error) {
    console.error("Track API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
