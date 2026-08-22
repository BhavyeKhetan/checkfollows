import { createServerClient } from "@/lib/supabase/server";

/**
 * One-time upsell credits: history export, on-demand rescan, mutual follows.
 *
 * A Stripe one-time payment (mode: "payment") credits `one_time_purchases`
 * rows for the signed-in user. Consuming a credit increments `consumed` on the
 * oldest row with remaining balance. Credits are user-scoped; a mutuals
 * purchase also records the target it was created for (audit only).
 */

export type OneTimeKind = "export" | "export_unlimited" | "rescan_credits" | "mutuals";

// Mutex map to prevent concurrent race-condition inserts across parallel requests
const inFlightGrants = new Map<string, Promise<void>>();

/**
 * Checks if a user has purchased the Unlimited Lifetime Exports Pass.
 */
export async function hasUnlimitedExports(userId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("one_time_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "export_unlimited")
    .limit(1)
    .maybeSingle();

  return !!data;
}

/**
 * Ensures every account on a Basic or Premium plan gets exactly 1 free rescan credit.
 * Completely idempotent and self-healing against concurrent race conditions.
 */
export async function ensureFreePlanCredits(userId: string): Promise<void> {
  const ongoing = inFlightGrants.get(userId);
  if (ongoing) return ongoing;

  const promise = (async () => {
    try {
      const supabase = createServerClient();
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("active", true)
        .not("stripe_subscription_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (!sub) return;

      const { data: existingRows } = await supabase
        .from("one_time_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("stripe_session_id", "plan_free_rescan")
        .order("created_at", { ascending: true });

      if (!existingRows || existingRows.length === 0) {
        await supabase.from("one_time_purchases").insert({
          user_id: userId,
          kind: "rescan_credits",
          credits: 1,
          consumed: 0,
          stripe_session_id: "plan_free_rescan",
        });
      } else if (existingRows.length > 1) {
        // Remove any duplicates caused by prior race conditions
        const duplicateIds = existingRows.slice(1).map((r) => r.id);
        await supabase.from("one_time_purchases").delete().in("id", duplicateIds);
      }
    } catch (err) {
      console.error("Failed to ensure free plan rescan credits:", err);
    } finally {
      inFlightGrants.delete(userId);
    }
  })();

  inFlightGrants.set(userId, promise);
  return promise;
}

export async function getRemainingCredits(
  userId: string,
  kind: "export" | "rescan_credits" | "mutuals"
): Promise<number> {
  if (kind === "rescan_credits") {
    await ensureFreePlanCredits(userId);
  }
  if (kind === "export" && (await hasUnlimitedExports(userId))) {
    return 999999;
  }
  const supabase = createServerClient();
  const { data } = await supabase
    .from("one_time_purchases")
    .select("credits, consumed")
    .eq("user_id", userId)
    .eq("kind", kind);

  return (data || []).reduce(
    (sum, p) => sum + Math.max(0, p.credits - p.consumed),
    0
  );
}

export interface CreditsSummary {
  export: number;
  rescan_credits: number;
  mutuals: number;
  unlimited_export: boolean;
}

export async function getCreditsSummary(
  userId: string
): Promise<CreditsSummary> {
  await ensureFreePlanCredits(userId);

  const supabase = createServerClient();
  const { data } = await supabase
    .from("one_time_purchases")
    .select("kind, credits, consumed")
    .eq("user_id", userId);

  let hasUnlimitedExp = false;
  const summary: Record<"export" | "rescan_credits" | "mutuals", number> = {
    export: 0,
    rescan_credits: 0,
    mutuals: 0,
  };

  for (const row of data || []) {
    const kind = row.kind;
    if (kind === "export_unlimited") {
      hasUnlimitedExp = true;
    } else if (kind in summary) {
      summary[kind as keyof typeof summary] += Math.max(0, row.credits - row.consumed);
    }
  }

  return {
    ...summary,
    unlimited_export: hasUnlimitedExp,
  };
}

/**
 * Consume a single credit of `kind` for the user. Returns false when no
 * remaining credit exists. The `consumed = old` guard keeps concurrent
 * requests from double-spending the same credit.
 */
export async function consumeCredit(
  userId: string,
  kind: "export" | "rescan_credits" | "mutuals"
): Promise<boolean> {
  if (kind === "export" && (await hasUnlimitedExports(userId))) {
    return true;
  }

  const supabase = createServerClient();
  const { data: purchases } = await supabase
    .from("one_time_purchases")
    .select("id, credits, consumed")
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("created_at", { ascending: true });

  const target = (purchases || []).find((p) => p.consumed < p.credits);
  if (!target) return false;

  const { error } = await supabase
    .from("one_time_purchases")
    .update({ consumed: target.consumed + 1 })
    .eq("id", target.id)
    .eq("consumed", target.consumed);

  return !error;
}
