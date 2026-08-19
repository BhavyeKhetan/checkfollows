import { NextResponse } from "next/server";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getCreditsSummary } from "@/lib/purchases";

/**
 * GET /api/account
 * Requires an authenticated Supabase session.
 * Returns the user's subscription rows + the Instagram targets they track.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const active = await hasActiveSubscription(user.id);

  const { data: subs, error: subsError } = await supabase
    .from("subscriptions")
    .select(
      "id, target_id, plan, tier, active, user_paused, stripe_subscription_id, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (subsError) {
    console.error("account: subscriptions fetch error:", subsError.message);
    return NextResponse.json(
      { success: false, error: "Failed to load account" },
      { status: 500 }
    );
  }

  const paidSubs = (subs || []).filter((s) => !!s.stripe_subscription_id);
  const latestPaid = paidSubs[0];
  const targetIds = [...new Set(
    (subs || [])
      .map((s) => s.target_id)
      .filter((id): id is string => !!id)
  )];

  if (!active) {
    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      hasActiveSubscription: false,
      subscriptions: [],
      credits: { export: 0, rescan_credits: 0, mutuals: 0 },
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

  const [spikeRow, credits] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("spike_threshold")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getCreditsSummary(user.id),
  ]);

  let targets: Record<string, unknown>[] = [];
  if (targetIds.length > 0) {
    const { data } = await supabase
      .from("instagram_targets")
      .select(
        "id, username, full_name, avatar_url, is_verified, monitoring_enabled, last_scanned_at, next_scan_at, following_count, follower_count"
      )
      .in("id", targetIds);
    targets = data || [];
  }

  const targetsById = new Map(targets.map((t) => [t.id as string, t]));

  const subscriptions = (subs || []).map((s) => ({
    id: s.id,
    plan: s.plan,
    tier: s.tier,
    active: s.active,
    user_paused: s.user_paused,
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

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email },
    hasActiveSubscription: active,
    spikeThreshold: spikeRow.data?.spike_threshold ?? 5,
    credits,
    subscriptions,
  });
}
