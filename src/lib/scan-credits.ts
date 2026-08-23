import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/stripe";
import {
  INCLUDED_WEEKLY_SCAN_CREDITS,
} from "@/lib/scan-credit-policy";

export { scanCreditsForFollowingCount } from "@/lib/scan-credit-policy";

export type ScanCreditReason = "baseline" | "automatic" | "manual";

export interface ScanCreditSummary {
  included: number;
  purchased: number;
  total: number;
  weeklyAllowance: number;
  refreshAt: string;
  tier: PlanTier;
}

export interface ScanCreditReservation {
  reserved: boolean;
  reservationId: string | null;
  included: number;
  purchased: number;
  total: number;
  refreshAt: string | null;
}

async function loadPlanForWallet(userId: string): Promise<{
  tier: PlanTier;
  stripeSubscriptionId: string;
} | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("tier, stripe_subscription_id, updated_at")
    .eq("user_id", userId)
    .eq("active", true)
    .not("stripe_subscription_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load scan credit plan: ${error.message}`);
  const stripeSubscriptionId = data?.[0]?.stripe_subscription_id;
  if (!stripeSubscriptionId) return null;
  const canonicalRows = (data || []).filter(
    (row) => row.stripe_subscription_id === stripeSubscriptionId
  );
  return {
    tier: canonicalRows.some((row) => row.tier === "premium")
      ? "premium"
      : "base",
    stripeSubscriptionId,
  };
}

async function migrateLegacyRescanCredits(userId: string): Promise<void> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("one_time_purchases")
    .select("id, credits, consumed")
    .eq("user_id", userId)
    .eq("kind", "rescan_credits")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load legacy scan credits: ${error.message}`);

  for (const row of data || []) {
    const remaining = Math.max(0, row.credits - row.consumed);
    if (remaining <= 0) continue;
    const { error: grantError } = await supabase.rpc(
      "grant_purchased_scan_credits",
      {
        p_user_id: userId,
        p_units: remaining,
        p_idempotency_key: `legacy-one-time:${row.id}`,
        p_reason: "legacy_rescan_credit",
      }
    );
    if (grantError) {
      throw new Error(`Failed to migrate legacy scan credits: ${grantError.message}`);
    }
    const { error: consumeError } = await supabase
      .from("one_time_purchases")
      .update({ consumed: row.credits })
      .eq("id", row.id)
      .eq("consumed", row.consumed);
    if (consumeError) {
      throw new Error(`Failed to close legacy scan credits: ${consumeError.message}`);
    }
  }
}

async function refundStaleReservations(userId: string): Promise<void> {
  const supabase = createServerClient();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("scan_credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("entry_type", "reservation")
    .eq("status", "reserved")
    .lt("created_at", cutoff)
    .limit(20);
  if (error) {
    throw new Error(`Failed to inspect stale scan credits: ${error.message}`);
  }
  for (const row of data || []) {
    const { error: refundError } = await supabase.rpc(
      "refund_scan_credit_reservation",
      { p_reservation_id: row.id, p_reason: "stale_reservation" }
    );
    if (refundError) {
      throw new Error(`Failed to refund stale scan credits: ${refundError.message}`);
    }
  }
}

export async function getScanCreditSummary(
  userId: string
): Promise<ScanCreditSummary | null> {
  const plan = await loadPlanForWallet(userId);
  if (!plan) return null;

  const allowance = INCLUDED_WEEKLY_SCAN_CREDITS[plan.tier];
  const supabase = createServerClient();
  const { error } = await supabase.rpc("sync_scan_credit_wallet", {
    p_user_id: userId,
    p_tier: plan.tier,
    p_allowance: allowance,
    p_stripe_subscription_id: plan.stripeSubscriptionId,
  });
  if (error) throw new Error(`Failed to sync scan credits: ${error.message}`);

  await refundStaleReservations(userId);
  await migrateLegacyRescanCredits(userId);

  const { data: wallet, error: walletError } = await supabase
    .from("scan_credit_wallets")
    .select("included_balance, purchased_balance, included_allowance, refresh_at, tier")
    .eq("user_id", userId)
    .single();
  if (walletError) {
    throw new Error(`Failed to load scan credits: ${walletError.message}`);
  }

  return {
    included: wallet.included_balance,
    purchased: wallet.purchased_balance,
    total: wallet.included_balance + wallet.purchased_balance,
    weeklyAllowance: wallet.included_allowance,
    refreshAt: wallet.refresh_at,
    tier: wallet.tier === "premium" ? "premium" : "base",
  };
}

export async function reserveUserScanCredits(args: {
  userId: string;
  targetId: string;
  units: number;
  reason: ScanCreditReason;
  idempotencyKey: string;
}): Promise<ScanCreditReservation> {
  await getScanCreditSummary(args.userId);
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("reserve_scan_credits", {
    p_user_id: args.userId,
    p_units: args.units,
    p_target_id: args.targetId,
    p_reason: args.reason,
    p_idempotency_key: args.idempotencyKey,
  });
  if (error) throw new Error(`Failed to reserve scan credits: ${error.message}`);
  const row = data?.[0];
  return {
    reserved: row?.reserved === true,
    reservationId: row?.reservation_id || null,
    included: row?.included_balance || 0,
    purchased: row?.purchased_balance || 0,
    total: (row?.included_balance || 0) + (row?.purchased_balance || 0),
    refreshAt: row?.refresh_at || null,
  };
}

export async function completeScanCreditReservation(
  reservationId: string,
  scanId?: string | null
): Promise<void> {
  const { error } = await createServerClient().rpc(
    "complete_scan_credit_reservation",
    { p_reservation_id: reservationId, p_scan_id: scanId || null }
  );
  if (error) throw new Error(`Failed to complete scan credits: ${error.message}`);
}

export async function refundScanCreditReservation(
  reservationId: string,
  reason: string
): Promise<void> {
  const { error } = await createServerClient().rpc(
    "refund_scan_credit_reservation",
    { p_reservation_id: reservationId, p_reason: reason }
  );
  if (error) throw new Error(`Failed to refund scan credits: ${error.message}`);
}

export async function grantPurchasedScanCredits(args: {
  userId: string;
  units: number;
  idempotencyKey: string;
  reason?: string;
}): Promise<boolean> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("grant_purchased_scan_credits", {
    p_user_id: args.userId,
    p_units: args.units,
    p_idempotency_key: args.idempotencyKey,
    p_reason: args.reason || "purchase",
  });
  if (error) throw new Error(`Failed to grant scan credits: ${error.message}`);
  return data?.[0]?.granted === true;
}
