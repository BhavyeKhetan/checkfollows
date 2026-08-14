import { createServerClient } from "@/lib/supabase/server";

/**
 * One-time upsell credits: history export, on-demand rescan, mutual follows.
 *
 * A Stripe one-time payment (mode: "payment") credits `one_time_purchases`
 * rows for the signed-in user. Consuming a credit increments `consumed` on the
 * oldest row with remaining balance. Credits are user-scoped; a mutuals
 * purchase also records the target it was created for (audit only).
 */

export type OneTimeKind = "export" | "rescan_credits" | "mutuals";

export async function getRemainingCredits(
  userId: string,
  kind: OneTimeKind
): Promise<number> {
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

export async function getCreditsSummary(
  userId: string
): Promise<Record<OneTimeKind, number>> {
  const [exportCredits, rescanCredits, mutualsCredits] = await Promise.all([
    getRemainingCredits(userId, "export"),
    getRemainingCredits(userId, "rescan_credits"),
    getRemainingCredits(userId, "mutuals"),
  ]);

  return {
    export: exportCredits,
    rescan_credits: rescanCredits,
    mutuals: mutualsCredits,
  };
}

/**
 * Consume a single credit of `kind` for the user. Returns false when no
 * remaining credit exists. The `consumed = old` guard keeps concurrent
 * requests from double-spending the same credit.
 */
export async function consumeCredit(
  userId: string,
  kind: OneTimeKind
): Promise<boolean> {
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
