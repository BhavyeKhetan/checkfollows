import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { enableMonitoring, disableMonitoring } from "@/lib/monitoring";
import { INCLUDED_ACCOUNTS } from "@/lib/account-capacity-rules";
import { getAccountCapacity } from "@/lib/account-capacity";
import {
  getStripe,
  getStripePriceId,
  getEmailAlertsPriceId,
  type PlanTier,
} from "@/lib/stripe";

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
    const { targetId, action = "start", email_alerts } = body;
    const emailAlerts = email_alerts === true || email_alerts === "true";

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: "targetId is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Tracking is a paid, authenticated action. Use the signed-in user's
    // email so subscriptions are tied to the account, not a free-form string.
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Sign in to manage tracking" },
        { status: 401 }
      );
    }
    const email =
      authUser.email || (typeof body.email === "string" ? body.email : "");
    const tier: PlanTier = body.tier === "premium" ? "premium" : "base";

    // Both plans now use concurrent capacity: stopping one target frees a slot.
    const countTracked = async () => {
      const { count, error } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", authUser.id)
        .eq("active", true)
        .eq("user_paused", false)
        .not("target_id", "is", null);
      if (error) throw new Error(`Failed to count tracked accounts: ${error.message}`);
      return count ?? 0;
    };

    const capacityError = (
      currentCount: number,
      maxAllowed: number,
      paidTier: PlanTier
    ) =>
      NextResponse.json(
        {
          success: false,
          error: `You're using all ${maxAllowed} concurrent account slots. Add another slot for ${paidTier === "premium" ? "this Premium" : "this Basic"} subscription, or pause an account first.`,
          atLimit: true,
          canAddCapacity: true,
          currentCount,
          maxAllowed,
          tier: paidTier,
        },
        { status: 402 }
      );

    // ─── STOP: disable monitoring + mark user-paused ──
    // user_paused = true prevents Stripe lifecycle events from silently
    // re-enabling this account later (see webhook handler).
    if (action === "stop") {
      const { data: ownedRow } = await supabase
        .from("subscriptions")
        .select("id, active")
        .eq("target_id", targetId)
        .eq("user_id", authUser.id)
        .not("stripe_subscription_id", "is", null)
        .maybeSingle();

      if (!ownedRow) {
        return NextResponse.json(
          { success: false, error: "Tracked account not found" },
          { status: 404 }
        );
      }

      await supabase
        .from("subscriptions")
        .update({
          user_paused: true,
          // `active` represents the Stripe entitlement. Pausing monitoring
          // frees concurrent capacity without making the subscription inactive.
          active: ownedRow.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ownedRow.id);

      // Targets are shared records. Keep the underlying monitor running if a
      // different paying customer still has this same target active.
      const { count: remainingSubscribers } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("target_id", targetId)
        .eq("active", true)
        .eq("user_paused", false)
        .not("stripe_subscription_id", "is", null);
      if (!remainingSubscribers) await disableMonitoring(targetId);

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
      .select("id, plan, active, user_paused, stripe_subscription_id")
      .eq("target_id", targetId)
      .eq("user_id", authUser.id)
      .or("active.eq.true,user_paused.eq.true")
      .not("stripe_subscription_id", "is", null)
      .maybeSingle();

    if (existingPaid) {
      if (!existingPaid.active || existingPaid.user_paused) {
        const capacity = await getAccountCapacity(authUser.id);
        if (!capacity) {
          return NextResponse.json(
            { success: false, error: "Your subscription is not active" },
            { status: 402 }
          );
        }
        if (capacity.activeAccounts >= capacity.totalAccounts) {
          return capacityError(
            capacity.activeAccounts,
            capacity.totalAccounts,
            capacity.tier
          );
        }
      }

      // Clear the user-pause flag so webhook events can manage it again.
      await supabase
        .from("subscriptions")
        .update({
          user_id: authUser.id,
          user_paused: false,
          active: true,
          updated_at: new Date().toISOString(),
        })
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
      .select("stripe_customer_id, stripe_subscription_id, plan, tier")
      .eq("user_id", authUser.id)
      .or("active.eq.true,user_paused.eq.true")
      .not("stripe_subscription_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paidSub) {
      const paidTier: PlanTier =
        paidSub.tier === "premium" ? "premium" : "base";
      const capacity = await getAccountCapacity(authUser.id);
      if (!capacity) {
        return NextResponse.json(
          { success: false, error: "Your subscription is not active" },
          { status: 402 }
        );
      }
      const count = capacity.activeAccounts;
      const cap = capacity.totalAccounts;

      if (count >= cap) {
        return capacityError(count, cap, paidTier);
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
            user_id: authUser.id,
            plan: paidSub.plan || "basic",
            tier: paidTier,
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
            user_id: authUser.id,
            email,
            plan: paidSub.plan || "basic",
            tier: paidTier,
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
    const count = await countTracked();
    const cap = INCLUDED_ACCOUNTS[tier];

    if (count >= cap) {
      return NextResponse.json(
        {
          success: false,
          error: `You're using all ${cap} included concurrent account slots. Subscribe first, then add more slots whenever you need them.`,
          atLimit: true,
          canAddCapacity: false,
          currentCount: count,
          maxAllowed: cap,
          tier,
        },
        { status: 402 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const stripe = getStripe();
    const priceId = getStripePriceId("weekly", tier);

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: priceId, quantity: 1 },
    ];
    if (emailAlerts) {
      lineItems.push({ price: getEmailAlertsPriceId("weekly"), quantity: 1 });
    }

    // "pro" plan = email alerts enabled (add-on). "basic" = monitoring only.
    const plan = emailAlerts ? "pro" : "basic";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      customer_email: email,
      success_url: `${baseUrl}/track/${encodeURIComponent(
        target.username
      )}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/track/${encodeURIComponent(
        target.username
      )}?canceled=true`,
      subscription_data: {
        metadata: {
          product: "checkfollows",
          cadence: "weekly",
          tier,
          plan,
          email_alerts: String(emailAlerts),
          target_id: targetId,
          username: target.username,
          email,
          user_id: authUser.id,
        },
      },
      metadata: {
        product: "checkfollows",
        cadence: "weekly",
        tier,
        plan,
        email_alerts: String(emailAlerts),
        target_id: targetId,
        username: target.username,
        email,
        user_id: authUser.id,
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
