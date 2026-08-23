import type { PlanTier } from "@/lib/stripe";

export const SCAN_CREDITS_PER_THOUSAND = 1;
export const INCLUDED_WEEKLY_SCAN_CREDITS: Record<PlanTier, number> = {
  base: 12,
  premium: 18,
};

export function scanCreditsForFollowingCount(followingCount: number): number {
  const normalized = Number.isFinite(followingCount)
    ? Math.max(0, Math.floor(followingCount))
    : 0;
  return Math.max(
    1,
    Math.ceil(normalized / 1000) * SCAN_CREDITS_PER_THOUSAND
  );
}
