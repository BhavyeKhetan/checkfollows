import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getCreditsSummary } from "@/lib/purchases";
import {
  getAccountCapacity,
  publicCapacity,
  type AccountCapacitySubscriptionRow,
} from "@/lib/account-capacity";
import { removalPolicy } from "@/lib/account-removal";

function accountResponse(
  startedAt: number,
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Server-Timing": `account;dur=${(performance.now() - startedAt).toFixed(1)}`,
    },
  });
}

/**
 * GET /api/account
 * Requires an authenticated Supabase session.
 * Returns the user's subscription rows + the Instagram targets they track.
 */
export async function GET() {
  const startedAt = performance.now();
  const user = await getAuthUser();
  if (!user) {
    return accountResponse(startedAt, { error: "Unauthorized" }, 401);
  }

  const supabase = createServerClient();
  const { data: subs, error: subsError } = await supabase
    .from("subscriptions")
    .select(
      "id, target_id, plan, tier, active, user_paused, removed_at, stripe_subscription_id, spike_threshold, scan_credit_auto_limit, scan_credit_consent_at, scan_credit_blocked_at, scan_credit_required, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (subsError) {
    console.error("account: subscriptions fetch error:", subsError.message);
    return accountResponse(
      startedAt,
      { success: false, error: "Failed to load account" },
      500
    );
  }

  const paidSubs = (subs || []).filter((s) => !!s.stripe_subscription_id);
  const latestPaid = paidSubs[0];
  const targetIds = [...new Set(
    (subs || [])
      .map((s) => s.target_id)
      .filter((id): id is string => !!id)
  )];

  const canonicalActive = paidSubs.find((subscription) => subscription.active);
  const canonicalStripeId = canonicalActive?.stripe_subscription_id || null;
  const canonicalRows = canonicalStripeId
    ? paidSubs.filter(
        (subscription) =>
          subscription.active &&
          subscription.stripe_subscription_id === canonicalStripeId
      )
    : [];
  const scanPlan = canonicalStripeId
    ? {
        tier: canonicalRows.some((subscription) => subscription.tier === "premium")
          ? ("premium" as const)
          : ("base" as const),
        stripeSubscriptionId: canonicalStripeId,
      }
    : null;

  const targetsPromise = targetIds.length > 0
    ? supabase
        .from("instagram_targets")
        .select(
          "id, username, full_name, avatar_url, is_verified, monitoring_enabled, last_scanned_at, next_scan_at, following_count, follower_count"
        )
        .in("id", targetIds)
    : Promise.resolve({ data: [], error: null });

  const [capacity, credits, targetResult] = await Promise.all([
    getAccountCapacity(
      user.id,
      (subs || []) as AccountCapacitySubscriptionRow[]
    ),
    getCreditsSummary(user.id, scanPlan),
    targetsPromise,
  ]);
  const active = !!capacity;

  if (!active) {
    return accountResponse(startedAt, {
      success: true,
      user: { id: user.id, email: user.email },
      hasActiveSubscription: false,
      subscriptions: [],
      credits: {
        export: 0,
        rescan_credits: 0,
        mutuals: 0,
        scan_included: 0,
        scan_purchased: 0,
        scan_weekly_allowance: 0,
        scan_refresh_at: null,
      },
      spikeThreshold: 5,
      lockedTrackedAccountCount: targetIds.length,
      canRenew: paidSubs.length > 0,
      renewalDefaults: {
        tier: latestPaid?.tier === "premium" ? "premium" : "base",
        emailAlerts: latestPaid?.plan === "pro",
        cadence: "weekly",
      },
    });
  }

  const targets = (targetResult.data || []) as Record<string, unknown>[];

  const targetsById = new Map(targets.map((t) => [t.id as string, t]));

  const subscriptions = (subs || [])
    .filter((s) => !s.removed_at)
    .map((s) => ({
    id: s.id,
    plan: s.plan,
    tier: s.tier,
    active: s.active,
    user_paused: s.user_paused,
    scan_credit_auto_limit: s.scan_credit_auto_limit,
    scan_credit_consent_at: s.scan_credit_consent_at,
    scan_credit_blocked_at: s.scan_credit_blocked_at,
    scan_credit_required: s.scan_credit_required,
    created_at: s.created_at,
    updated_at: s.updated_at,
    target: s.target_id
      ? (() => {
          const target = targetsById.get(s.target_id);
          return target
            ? {
                ...target,
                monitoring_enabled:
                  target.monitoring_enabled === true && !s.user_paused,
              }
            : null;
        })()
      : null,
  }));

  const lastRemovedAt =
    (subs || [])
      .map((s) => s.removed_at)
      .filter((value): value is string => !!value)
      .sort()
      .at(-1) || null;

  return accountResponse(startedAt, {
    success: true,
    user: { id: user.id, email: user.email },
    hasActiveSubscription: active,
    spikeThreshold: subs?.[0]?.spike_threshold ?? 5,
    credits,
    capacity: capacity ? publicCapacity(capacity) : null,
    removal: removalPolicy(capacity.tier, lastRemovedAt),
    subscriptions,
  });
}
