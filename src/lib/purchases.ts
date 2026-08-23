import { createServerClient } from "@/lib/supabase/server";
import { getScanCreditSummary } from "@/lib/scan-credits";

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
 * Legacy entrypoint retained for webhook callers. It now synchronizes the
 * subscriber's weekly pooled scan-credit wallet.
 */
export async function ensureFreePlanCredits(userId: string): Promise<void> {
  const ongoing = inFlightGrants.get(userId);
  if (ongoing) return ongoing;

  const promise = (async () => {
    try {
      await getScanCreditSummary(userId);
    } catch (err) {
      console.error("Failed to synchronize plan scan credits:", err);
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
    return (await getScanCreditSummary(userId))?.total || 0;
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
  scan_included: number;
  scan_purchased: number;
  scan_weekly_allowance: number;
  scan_refresh_at: string | null;
}

export async function getCreditsSummary(
  userId: string
): Promise<CreditsSummary> {
  const scanCredits = await getScanCreditSummary(userId);

  const supabase = createServerClient();
  const { data } = await supabase
    .from("one_time_purchases")
    .select("kind, credits, consumed")
    .eq("user_id", userId);

  let hasUnlimitedExp = false;
  const summary: Record<"export" | "rescan_credits" | "mutuals", number> = {
    export: 0,
    rescan_credits: scanCredits?.total || 0,
    mutuals: 0,
  };

  for (const row of data || []) {
    const kind = row.kind;
    if (kind === "export_unlimited") {
      hasUnlimitedExp = true;
    } else if (kind !== "rescan_credits" && kind in summary) {
      summary[kind as keyof typeof summary] += Math.max(0, row.credits - row.consumed);
    }
  }

  return {
    ...summary,
    unlimited_export: hasUnlimitedExp,
    scan_included: scanCredits?.included || 0,
    scan_purchased: scanCredits?.purchased || 0,
    scan_weekly_allowance: scanCredits?.weeklyAllowance || 0,
    scan_refresh_at: scanCredits?.refreshAt || null,
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

  // Full scans use multi-unit atomic reservations in scan-credits.ts. Keep
  // this legacy function limited to the fixed-price export/mutual add-ons.
  if (kind === "rescan_credits") return false;

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
