export interface TrackedTarget {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  monitoring_enabled: boolean;
  last_scanned_at: string | null;
  next_scan_at: string | null;
  following_count: number;
  follower_count: number;
}

export interface SubscriptionRow {
  id: string;
  plan: string;
  tier: string;
  active: boolean;
  user_paused: boolean;
  created_at: string;
  updated_at: string;
  target: TrackedTarget | null;
}

export interface AccountData {
  success: boolean;
  user: { id: string; email: string | null };
  hasActiveSubscription: boolean;
  spikeThreshold: number;
  credits: {
    export: number;
    rescan_credits: number;
    mutuals: number;
    unlimited_export?: boolean;
  };
  subscriptions: SubscriptionRow[];
  lockedTrackedAccountCount?: number;
  canRenew?: boolean;
  renewalDefaults?: {
    cadence: "weekly" | "quarterly";
    tier: "base" | "premium";
    emailAlerts: boolean;
  };
  removal?: {
    tier: "base" | "premium";
    canRemove: boolean;
    cooldownDays: number;
    lastRemovedAt: string | null;
    nextRemoveAt: string | null;
  };
  capacity?: {
    tier: "base" | "premium";
    cadence: "weekly" | "quarterly";
    includedAccounts: number;
    additionalAccounts: number;
    totalAccounts: number;
    activeAccounts: number;
    availableAccounts: number;
    unitAmount: number;
    currency: "usd";
  } | null;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
