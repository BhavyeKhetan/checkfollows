import type { PlanTier } from "@/lib/stripe";

export const BASIC_REMOVAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const BASIC_REMOVAL_COOLDOWN_DAYS = 7;

export interface RemovalPolicy {
  tier: PlanTier;
  canRemove: boolean;
  cooldownDays: number;
  lastRemovedAt: string | null;
  nextRemoveAt: string | null;
}

export function removalPolicy(
  tier: PlanTier,
  lastRemovedAt: string | null,
  now = Date.now()
): RemovalPolicy {
  if (tier === "premium") {
    return {
      tier,
      canRemove: true,
      cooldownDays: 0,
      lastRemovedAt,
      nextRemoveAt: null,
    };
  }

  if (!lastRemovedAt) {
    return {
      tier,
      canRemove: true,
      cooldownDays: BASIC_REMOVAL_COOLDOWN_DAYS,
      lastRemovedAt: null,
      nextRemoveAt: null,
    };
  }

  const next = new Date(lastRemovedAt).getTime() + BASIC_REMOVAL_COOLDOWN_MS;
  if (now >= next) {
    return {
      tier,
      canRemove: true,
      cooldownDays: BASIC_REMOVAL_COOLDOWN_DAYS,
      lastRemovedAt,
      nextRemoveAt: null,
    };
  }

  return {
    tier,
    canRemove: false,
    cooldownDays: BASIC_REMOVAL_COOLDOWN_DAYS,
    lastRemovedAt,
    nextRemoveAt: new Date(next).toISOString(),
  };
}

export function basicRemovalCooldownMessage(nextRemoveAt: string): string {
  const when = new Date(nextRemoveAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Basic plans can remove a tracked account once every ${BASIC_REMOVAL_COOLDOWN_DAYS} days. You can remove another on ${when}. Upgrade to Premium to remove anytime.`;
}
