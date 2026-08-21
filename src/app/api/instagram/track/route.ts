import { NextResponse } from "next/server";
import { getAccountCapacity } from "@/lib/account-capacity";
import {
  basicRemovalCooldownMessage,
  removalPolicy,
} from "@/lib/account-removal";
import { disableMonitoringIfUnused, enableMonitoring } from "@/lib/monitoring";
import { getAuthUser, ownsTarget } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/stripe";

/**
 * Starts or stops monitoring for an authenticated subscriber. Stripe-backed
 * concurrent capacity is enforced for both Basic and Premium subscriptions.
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

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Sign in to manage tracking" },
        { status: 401 }
      );
    }

    // Stripe, not a client-supplied tier or a stale database flag, is the
    // entitlement and additional-slot source of truth.
    const capacity = await getAccountCapacity(authUser.id);
    if (!capacity) {
      return NextResponse.json(
        {
          success: false,
          error: "An active subscription is required",
          paywall: "/app/pricing",
        },
        { status: 402 }
      );
    }

    const supabase = createServerClient();
    const email = authUser.email || "";

    const capacityError = (
      currentCount: number,
      maxAllowed: number,
      tier: PlanTier
    ) =>
      NextResponse.json(
        {
          success: false,
          error: `You're using all ${maxAllowed} concurrent account slots. Add another slot for this ${tier === "premium" ? "Premium" : "Basic"} subscription, or pause an account first.`,
          atLimit: true,
          canAddCapacity: true,
          currentCount,
          maxAllowed,
          tier,
        },
        { status: 402 }
      );

    if (action === "remove") {
      if (!(await ownsTarget(authUser.id, targetId, authUser.email))) {
        return NextResponse.json(
          { success: false, error: "Tracked account not found" },
          { status: 404 }
        );
      }

      const { data: removalRows, error: removalLookupError } = await supabase
        .from("subscriptions")
        .select("removed_at")
        .eq("user_id", authUser.id)
        .not("removed_at", "is", null)
        .order("removed_at", { ascending: false })
        .limit(1);

      if (removalLookupError) {
        throw new Error(`Failed to load removal history: ${removalLookupError.message}`);
      }

      const lastRemovedAt = removalRows?.[0]?.removed_at || null;
      const policy = removalPolicy(capacity.tier, lastRemovedAt);
      if (!policy.canRemove && policy.nextRemoveAt) {
        return NextResponse.json(
          {
            success: false,
            error: basicRemovalCooldownMessage(policy.nextRemoveAt),
            atRemovalLimit: true,
            nextRemoveAt: policy.nextRemoveAt,
            tier: capacity.tier,
          },
          { status: 429 }
        );
      }

      const now = new Date().toISOString();
      await supabase
        .from("subscriptions")
        .update({
          user_paused: true,
          removed_at: now,
          updated_at: now,
        })
        .eq("target_id", targetId)
        .eq("user_id", authUser.id)
        .is("removed_at", null);

      await disableMonitoringIfUnused(targetId);

      return NextResponse.json({
        success: true,
        message: "Account removed from your dashboard",
        removal: removalPolicy(capacity.tier, now),
      });
    }

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

      // Instagram targets are shared records. Stop the underlying scan only
      // when no other paying subscriber still monitors this target.
      await disableMonitoringIfUnused(targetId);

      return NextResponse.json({
        success: true,
        message: "Monitoring stopped for this account",
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "A valid account email is required" },
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

    const { data: existingPaid } = await supabase
      .from("subscriptions")
      .select("id, user_paused")
      .eq("target_id", targetId)
      .eq("user_id", authUser.id)
      .eq("active", true)
      .not("stripe_subscription_id", "is", null)
      .maybeSingle();

    if (existingPaid) {
      if (
        existingPaid.user_paused &&
        capacity.activeAccounts >= capacity.totalAccounts
      ) {
        return capacityError(
          capacity.activeAccounts,
          capacity.totalAccounts,
          capacity.tier
        );
      }

      await supabase
        .from("subscriptions")
        .update({
          user_paused: false,
          removed_at: null,
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

    if (capacity.activeAccounts >= capacity.totalAccounts) {
      return capacityError(
        capacity.activeAccounts,
        capacity.totalAccounts,
        capacity.tier
      );
    }

    const { data: paidSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, plan")
      .eq("user_id", authUser.id)
      .eq("active", true)
      .eq("stripe_subscription_id", capacity.stripeSubscriptionId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!paidSub) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your active subscription could not be resolved. Refresh your account and try again.",
        },
        { status: 409 }
      );
    }

    const { data: existingRow } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("target_id", targetId)
      .eq("email", email)
      .maybeSingle();

    const entitlementRow = {
      user_id: authUser.id,
      plan: paidSub.plan || "basic",
      tier: capacity.tier,
      stripe_customer_id: paidSub.stripe_customer_id,
      stripe_subscription_id: capacity.stripeSubscriptionId,
      active: true,
      user_paused: false,
      removed_at: null,
      updated_at: new Date().toISOString(),
    };

    if (existingRow) {
      const { error } = await supabase
        .from("subscriptions")
        .update(entitlementRow)
        .eq("id", existingRow.id);
      if (error) throw new Error(`Failed to attach account: ${error.message}`);
    } else {
      const { error } = await supabase.from("subscriptions").insert({
        target_id: targetId,
        email,
        ...entitlementRow,
      });
      if (error) throw new Error(`Failed to attach account: ${error.message}`);
    }

    await enableMonitoring(targetId);
    return NextResponse.json({
      success: true,
      attachedToExistingSubscription: true,
      message: `@${target.username} added to your subscription — monitoring is active`,
    });
  } catch (error) {
    console.error("Track API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
