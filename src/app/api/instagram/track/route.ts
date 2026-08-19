import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  getAuthUser,
  hasActiveSubscription,
  ownsTarget,
} from "@/lib/supabase/auth";
import {
  disableMonitoringIfUnused,
  enableMonitoring,
} from "@/lib/monitoring";
import type { PlanTier } from "@/lib/stripe";

// Plan tier account limits.
//   base    → 3 accounts total, ever (lifetime).
//   premium → unlimited accounts, but only 5 monitored at a time.
const BASE_LIFETIME_CAP = parseInt(process.env.BASE_LIFETIME_CAP || "3", 10);
const PREMIUM_CONCURRENT_CAP = parseInt(
  process.env.PREMIUM_CONCURRENT_CAP || "5",
  10
);

function capForTier(tier: PlanTier): number {
  return tier === "premium" ? PREMIUM_CONCURRENT_CAP : BASE_LIFETIME_CAP;
}

function capLabelForTier(tier: PlanTier): string {
  return tier === "premium"
    ? `${PREMIUM_CONCURRENT_CAP} at a time`
    : `${BASE_LIFETIME_CAP} total accounts`;
}

/**
 * Track Changes endpoint.
 *
 * GATES monitoring behind a Stripe subscription:
 *   - Already owns this target → enable monitoring (idempotent).
 *   - Has an active paid subscription → attach this target up to the plan cap.
 *   - No active subscription → return the authenticated app paywall.
 *
 * action=stop disables monitoring for the target (user-initiated stop).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetId, action = "start" } = body;

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
    if (!(await hasActiveSubscription(authUser.id))) {
      return NextResponse.json(
        {
          success: false,
          error: "An active subscription is required",
          paywall: "/app/pricing",
        },
        { status: 402 }
      );
    }
    const email =
      authUser.email || (typeof body.email === "string" ? body.email : "");

    // Count tracked accounts for a tier. Premium counts concurrent (active)
    // accounts; base counts lifetime (all rows, ever).
    const countTracked = async (t: PlanTier) => {
      let q = supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", authUser.id)
        .not("target_id", "is", null);
      if (t === "premium") {
        q = q.eq("active", true).eq("user_paused", false);
      }
      const { count } = await q;
      return count ?? 0;
    };

    // ─── STOP: disable monitoring + mark user-paused ──
    // user_paused = true prevents Stripe lifecycle events from silently
    // re-enabling this account later (see webhook handler).
    if (action === "stop") {
      if (!(await ownsTarget(authUser.id, targetId, authUser.email))) {
        return NextResponse.json(
          { success: false, error: "Tracked account not found" },
          { status: 404 }
        );
      }

      await supabase
        .from("subscriptions")
        .update({
          user_paused: true,
          updated_at: new Date().toISOString(),
        })
        .eq("target_id", targetId)
        .eq("user_id", authUser.id);
      await disableMonitoringIfUnused(targetId);

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
      .eq("user_id", authUser.id)
      .eq("active", true)
      .not("stripe_subscription_id", "is", null)
      .maybeSingle();

    if (existingPaid) {
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
      .eq("active", true)
      .not("stripe_subscription_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (paidSub) {
      const paidTier: PlanTier =
        paidSub.tier === "premium" ? "premium" : "base";
      const count = await countTracked(paidTier);
      const cap = capForTier(paidTier);

      if (count >= cap) {
        return NextResponse.json(
          {
            success: false,
            error: `You're tracking ${count} accounts already — the ${paidTier} plan allows ${capLabelForTier(paidTier)}. Upgrade to Premium to track more.`,
            atLimit: true,
            currentCount: count,
            maxAllowed: cap,
            tier: paidTier,
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

    return NextResponse.json(
      {
        success: false,
        error:
          "Your active subscription could not be resolved. Refresh your account and try again.",
      },
      { status: 409 }
    );
  } catch (error) {
    console.error("Track API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
