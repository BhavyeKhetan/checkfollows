"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  LogOut,
  Bell,
  ArrowRight,
  Eye,
  History,
  Lock,
  Activity,
  Save,
  Download,
  RefreshCw,
  Users,
  CreditCard,
  Sparkles,
  Pause,
  Play,
} from "lucide-react";
import { Button, Badge, Card, Avatar, Logo } from "@/design-system";
import { createClient } from "@/lib/supabase/client";
import { track, identify, reset } from "@/lib/mixpanel";
import { BillingManagement } from "@/components/account/billing-management";

interface TrackedTarget {
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

interface SubscriptionRow {
  id: string;
  plan: string;
  tier: string;
  active: boolean;
  user_paused: boolean;
  created_at: string;
  updated_at: string;
  target: TrackedTarget | null;
}

interface AccountData {
  success: boolean;
  user: { id: string; email: string | null };
  hasActiveSubscription: boolean;
  spikeThreshold: number;
  credits: { export: number; rescan_credits: number; mutuals: number };
  subscriptions: SubscriptionRow[];
  lockedTrackedAccountCount?: number;
  canRenew?: boolean;
  renewalDefaults?: {
    cadence: "weekly" | "quarterly";
    tier: "base" | "premium";
    emailAlerts: boolean;
  };
}

type RenewalCadence = "weekly" | "quarterly";
type RenewalTier = "base" | "premium";

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState("");
  const [spikeThreshold, setSpikeThreshold] = useState(5);
  const [savingSpike, setSavingSpike] = useState(false);
  const [spikeSaved, setSpikeSaved] = useState(false);
  const [renewalCadence, setRenewalCadence] = useState<RenewalCadence>("weekly");
  const [renewalTier, setRenewalTier] = useState<RenewalTier>("base");
  const [renewalEmailAlerts, setRenewalEmailAlerts] = useState(false);
  const [showWinbackOffer, setShowWinbackOffer] = useState(false);
  const [renewalLoading, setRenewalLoading] = useState<"standard" | "winback_50" | null>(null);
  const [renewalError, setRenewalError] = useState("");
  const [renewalSuccess, setRenewalSuccess] = useState(false);
  const [targetAction, setTargetAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/account");
        return;
      }

      identify(user.id, { $email: user.email ?? undefined });

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const returningFromRenewal = urlParams.get("renewed") === "1";
        const returningFromPurchase = urlParams.get("subscribed") === "1";
        const returningFromCheckout = returningFromRenewal || returningFromPurchase;
        const attempts = returningFromCheckout ? 6 : 1;
        for (let attempt = 0; attempt < attempts; attempt++) {
          const res = await fetch("/api/account", { cache: "no-store" });
          if (res.status === 401) {
            router.replace("/login?next=/account");
            return;
          }
          const json = await res.json();
          if (cancelled) return;
          if (!json.success) {
            setError(json.error || "Failed to load account");
            break;
          }
          if (json.hasActiveSubscription || attempt === attempts - 1) {
            setData(json);
            setSpikeThreshold(json.spikeThreshold ?? 5);
            if (json.renewalDefaults) {
              setRenewalCadence(json.renewalDefaults.cadence || "weekly");
              setRenewalTier(json.renewalDefaults.tier || "base");
              setRenewalEmailAlerts(json.renewalDefaults.emailAlerts === true);
            }
            if (returningFromCheckout && json.hasActiveSubscription) {
              setRenewalSuccess(true);
              track(returningFromRenewal ? "renewal_completed" : "subscription_activated", {
                source: "app",
              });
              window.history.replaceState({}, "", "/account");
            }
            track("account_viewed", {
              has_active_subscription: json.hasActiveSubscription,
            });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    track("signed_out", { platform: "web" });
    await supabase.auth.signOut();
    reset();
    router.replace("/");
  };

  const handleSpikeSave = async () => {
    setSavingSpike(true);
    setSpikeSaved(false);
    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spike_threshold: spikeThreshold }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save setting");
      } else {
        setSpikeThreshold(json.spike_threshold ?? spikeThreshold);
        setSpikeSaved(true);
        track("spike_threshold_saved", {
          threshold: json.spike_threshold ?? spikeThreshold,
        });
        setTimeout(() => setSpikeSaved(false), 2000);
      }
    } catch {
      setError("Network error");
    } finally {
      setSavingSpike(false);
    }
  };

  const startRenewal = async (offer: "standard" | "winback_50") => {
    if (renewalLoading) return;
    setRenewalLoading(offer);
    setRenewalError("");
    track("renewal_checkout_started", {
      offer,
      cadence: renewalCadence,
      tier: renewalTier,
      email_alerts: renewalEmailAlerts,
    });
    try {
      const res = await fetch("/api/stripe/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer,
          cadence: renewalCadence,
          tier: renewalTier,
          email_alerts: renewalEmailAlerts,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setRenewalError(json.error || "Renewal checkout could not be started.");
        setRenewalLoading(null);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setRenewalError("Network error. Please try again.");
      setRenewalLoading(null);
    }
  };

  const toggleTrackedAccount = async (target: TrackedTarget) => {
    if (targetAction) return;
    setTargetAction(target.id);
    setError("");
    const action = target.monitoring_enabled ? "stop" : "start";
    try {
      const response = await fetch("/api/instagram/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: target.id, action }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error || "The tracked account could not be updated.");
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              subscriptions: current.subscriptions.map((subscription) =>
                subscription.target?.id === target.id
                  ? {
                      ...subscription,
                      user_paused: action === "stop",
                      target: {
                        ...subscription.target,
                        monitoring_enabled: action === "start",
                      },
                    }
                  : subscription
              ),
            }
          : current
      );
      track("monitoring_toggled", { action, username: target.username });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTargetAction(null);
    }
  };

  const trackedTargets = (data?.subscriptions || [])
    .map((s) => s.target)
    .filter((t): t is TrackedTarget => !!t);

  const planLabel = (plan: string, tier?: string) => {
    const base = tier === "premium" ? "Premium" : "Basic";
    return plan === "pro" ? `${base} (with email alerts)` : base;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-3 border-[#121212] border-t-[#E7F256] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* Header */}
      <nav className="sticky top-0 z-50 ramp-glass">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-bold text-[#555555] hover:text-[#121212] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 space-y-6">
        {/* Account header */}
        <div>
          <Badge variant="mono" size="sm" className="mb-3">
            YOUR ACCOUNT
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212]">
            {data?.user.email || "Account"}
          </h1>
          <p className="text-sm text-[#555555] mt-1 font-medium">
            Manage your subscription and tracked accounts.
          </p>
        </div>

        {error && (
          <Card variant="subtle" className="border-[#FCA5A5]">
            <p className="text-sm text-[#B91C1C] font-medium">{error}</p>
          </Card>
        )}

        {renewalSuccess && (
          <Card variant="highlight" className="border-[#86EFAC]">
            <p className="text-sm font-bold text-[#047857]">
              Subscription active. Your dashboard and monitoring are ready.
            </p>
          </Card>
        )}

        {/* Subscription status */}
        <Card
          variant={data?.hasActiveSubscription ? "highlight" : "subtle"}
          padding="lg"
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                data?.hasActiveSubscription
                  ? "bg-[#121212] text-[#E7F256]"
                  : "bg-[#EDEDE8] text-[#555555]"
              }`}
            >
              {data?.hasActiveSubscription ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-[#121212]">
                {data?.hasActiveSubscription
                  ? "Active subscription"
                  : data?.canRenew
                    ? "Subscription inactive"
                    : "No active subscription"}
              </h2>
              <p className="text-sm text-[#555555] mt-0.5">
                {data?.hasActiveSubscription
                  ? `${planLabel(
                      data.subscriptions.find((s) => s.active)?.plan || "basic",
                      data.subscriptions.find((s) => s.active)?.tier
                    )} · every-other-day monitoring enabled`
                  : data?.canRenew
                    ? "Your account is still here. Renew to reveal your tracked accounts and resume monitoring."
                    : "Subscribe to unlock full following lists and every-other-day monitoring."}
              </p>
            </div>
            {!data?.hasActiveSubscription &&
              (data?.canRenew ? (
                <a href="#renew-subscription">
                  <Button
                    variant="primary"
                    size="md"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Renew subscription
                  </Button>
                </a>
              ) : (
                <Link href="/app/pricing">
                  <Button
                    variant="primary"
                    size="md"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={() =>
                      track("subscribe_cta_clicked", { location: "account" })
                    }
                  >
                    Subscribe
                  </Button>
                </Link>
              ))}
          </div>
        </Card>

        {(data?.hasActiveSubscription || data?.canRenew) && (
          <BillingManagement
            onPlanChanged={({ tier: nextTier, emailAlerts: nextEmailAlerts }) =>
              setData((current) =>
                current
                  ? {
                      ...current,
                      subscriptions: current.subscriptions.map((subscription) => ({
                        ...subscription,
                        tier: nextTier,
                        plan: nextEmailAlerts ? "pro" : "basic",
                      })),
                    }
                  : current
              )
            }
          />
        )}

        {data?.hasActiveSubscription ? (
          <>
        {/* Spike alerts */}
        <Card variant="subtle" padding="lg">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#EDEDE8] flex items-center justify-center shrink-0 text-[#121212]">
              <Activity className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-[#121212]">Suspicious-spike alerts</h2>
              <p className="text-sm text-[#555555] mt-0.5">
                Get alerted when a tracked account suddenly follows a burst of new people in one day.
              </p>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <label className="text-sm font-bold text-[#121212]">Alert me at</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={spikeThreshold}
                  onChange={(e) => setSpikeThreshold(parseInt(e.target.value, 10) || 1)}
                  className="w-20 rounded-lg border border-[#E2E2DC] bg-white px-3 py-2 text-base font-bold text-[#121212] outline-none focus:border-[#121212]"
                />
                <span className="text-sm text-[#555555] font-medium">new follows in one day</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSpikeSave}
                  isLoading={savingSpike}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  {spikeSaved ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* One-time add-ons (credits) */}
        <Card variant="subtle" padding="lg">
          <h2 className="text-base font-extrabold text-[#121212] mb-1">One-time add-ons</h2>
          <p className="text-xs text-[#555555] mb-4">
            Buy and use add-ons from any tracked account&apos;s page. Remaining balance:
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#E2E2DC] bg-white p-4 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-[#121212] shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-[#121212]">
                  {data?.credits?.rescan_credits ?? 0} left
                </div>
                <div className="text-xs text-[#555555]">On-demand rescans</div>
              </div>
            </div>
            <div className="rounded-xl border border-[#E2E2DC] bg-white p-4 flex items-center gap-3">
              <Download className="w-5 h-5 text-[#121212] shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-[#121212]">
                  {data?.credits?.export ?? 0} left
                </div>
                <div className="text-xs text-[#555555]">History exports</div>
              </div>
            </div>
            <div className="rounded-xl border border-[#E2E2DC] bg-white p-4 flex items-center gap-3">
              <Users className="w-5 h-5 text-[#121212] shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-[#121212]">
                  {data?.credits?.mutuals ?? 0} left
                </div>
                <div className="text-xs text-[#555555]">Mutual-follows reports</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tracked accounts */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-[#121212]">
              Tracked accounts ({trackedTargets.length})
            </h2>
            {data?.hasActiveSubscription && (
              <Link
                href="/app/add-account"
                className="text-xs font-bold text-[#121212] underline underline-offset-2"
                onClick={() => track("add_account_clicked")}
              >
                + Add account
              </Link>
            )}
          </div>

          {trackedTargets.length === 0 ? (
            <Card variant="subtle" className="text-center py-10">
              <Eye className="w-8 h-8 text-[#555555] mx-auto mb-3" />
              <p className="text-sm text-[#555555] font-medium max-w-xs mx-auto">
                You&apos;re not tracking anyone yet. Search a profile to start
                watching who they follow.
              </p>
              <Link href="/app/add-account" className="inline-block mt-4">
                <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Search a profile
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {trackedTargets.map((t) => (
                <Card key={t.id} hoverable padding="md" className="flex items-center gap-4">
                  <Avatar
                    src={t.avatar_url}
                    username={t.username}
                    isVerified={t.is_verified}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#121212] truncate">
                        {t.full_name || `@${t.username}`}
                      </span>
                      <Badge variant="mono" size="sm">@{t.username}</Badge>
                    </div>
                    <p className="text-xs text-[#555555] mt-0.5 flex items-center gap-2">
                      <span>
                        {t.following_count.toLocaleString()} following
                      </span>
                      <span className="text-[#E2E2DC]">·</span>
                      <span>Last checked {formatRelative(t.last_scanned_at)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.monitoring_enabled ? (
                      <Badge variant="lime" size="sm" className="flex items-center gap-1">
                        <Bell className="w-3 h-3" /> Monitoring
                      </Badge>
                    ) : (
                      <Badge variant="mono" size="sm">Paused</Badge>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={targetAction === t.id}
                      leftIcon={
                        t.monitoring_enabled ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )
                      }
                      onClick={() => toggleTrackedAccount(t)}
                    >
                      {t.monitoring_enabled ? "Pause" : "Resume"}
                    </Button>
                    <Link href={`/track/${encodeURIComponent(t.username)}`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                        onClick={() =>
                          track("tracked_account_opened", { username: t.username })
                        }
                      >
                        View
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Value strip */}
        <Card variant="subtle" padding="lg" className="grid sm:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-[#121212] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-[#121212]">Change alerts</h3>
              <p className="text-xs text-[#555555] mt-0.5">
                Emailed the moment they follow or unfollow someone.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <History className="w-5 h-5 text-[#121212] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-[#121212]">Accumulating history</h3>
              <p className="text-xs text-[#555555] mt-0.5">
                Every check builds a permanent timeline.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#047857] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-[#121212]">100% private</h3>
              <p className="text-xs text-[#555555] mt-0.5">
                The people you track are never notified.
              </p>
            </div>
          </div>
        </Card>
          </>
        ) : (
          <LockedAccount
            canRenew={data?.canRenew === true}
            trackedCount={data?.lockedTrackedAccountCount || 0}
            cadence={renewalCadence}
            tier={renewalTier}
            emailAlerts={renewalEmailAlerts}
            showWinback={showWinbackOffer}
            loading={renewalLoading}
            error={renewalError}
            onCadenceChange={setRenewalCadence}
            onTierChange={setRenewalTier}
            onEmailAlertsChange={setRenewalEmailAlerts}
            onRenew={() => startRenewal("standard")}
            onDecline={() => {
              setShowWinbackOffer(true);
              track("renewal_offer_revealed", { offer: "winback_50" });
            }}
            onWinback={() => startRenewal("winback_50")}
          />
        )}
      </main>
    </div>
  );
}

function LockedAccount({
  canRenew,
  trackedCount,
  cadence,
  tier,
  emailAlerts,
  showWinback,
  loading,
  error,
  onCadenceChange,
  onTierChange,
  onEmailAlertsChange,
  onRenew,
  onDecline,
  onWinback,
}: {
  canRenew: boolean;
  trackedCount: number;
  cadence: RenewalCadence;
  tier: RenewalTier;
  emailAlerts: boolean;
  showWinback: boolean;
  loading: "standard" | "winback_50" | null;
  error: string;
  onCadenceChange: (value: RenewalCadence) => void;
  onTierChange: (value: RenewalTier) => void;
  onEmailAlertsChange: (value: boolean) => void;
  onRenew: () => void;
  onDecline: () => void;
  onWinback: () => void;
}) {
  const cycleLabel = cadence === "weekly" ? "first week" : "first 3-month billing cycle";
  const basePrice =
    tier === "premium"
      ? cadence === "weekly" ? 12.99 : 64.99
      : cadence === "weekly" ? 9.99 : 49.99;
  const alertsPrice = emailAlerts ? (cadence === "weekly" ? 2 : 10) : 0;
  const total = basePrice + alertsPrice;

  if (!canRenew) {
    return (
      <section className="space-y-5">
        <Card variant="highlight" padding="lg" className="text-center py-10">
          <Lock className="w-8 h-8 mx-auto text-[#121212] mb-3" />
          <Badge variant="lime" size="sm" className="mb-3">SUBSCRIPTION REQUIRED</Badge>
          <h2 className="text-xl font-extrabold">Unlock your CheckFollows account</h2>
          <p className="text-sm text-[#555555] mt-2 mb-5 max-w-md mx-auto">
            Choose a subscription to reveal tracked accounts, monitoring history, alerts, exports, and rescans.
          </p>
          <Link href="/app/pricing">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              View subscription options
            </Button>
          </Link>
        </Card>
        <LockedPreview trackedCount={trackedCount} mode="subscribe" />
      </section>
    );
  }

  return (
    <section id="renew-subscription" className="space-y-5 scroll-mt-24">
      <Card variant="highlight" padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#121212] text-[#E7F256] flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <Badge variant="lime" size="sm" className="mb-2">REACTIVATE YOUR ACCOUNT</Badge>
            <h2 className="text-xl font-extrabold">Renew your subscription</h2>
            <p className="text-sm text-[#555555] mt-1">
              Your history is preserved. Renewal reveals it again and resumes every-other-day monitoring.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <ChoiceGroup
                label="Plan"
                value={tier}
                options={[
                  { value: "base", label: "Basic" },
                  { value: "premium", label: "Premium" },
                ]}
                onChange={(value) => onTierChange(value as RenewalTier)}
              />
              <ChoiceGroup
                label="Billing"
                value={cadence}
                options={[
                  { value: "weekly", label: "Weekly" },
                  { value: "quarterly", label: "Quarterly" },
                ]}
                onChange={(value) => onCadenceChange(value as RenewalCadence)}
              />
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(event) => onEmailAlertsChange(event.target.checked)}
                className="h-4 w-4 accent-[#121212]"
              />
              Include email change alerts
            </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                isLoading={loading === "standard"}
                onClick={onRenew}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Renew for ${total.toFixed(2)}{cadence === "weekly" ? "/week" : "/quarter"}
              </Button>
              {!showWinback && (
                <button
                  type="button"
                  onClick={onDecline}
                  className="text-sm font-bold text-[#555555] underline underline-offset-2"
                >
                  Not right now
                </button>
              )}
            </div>
            {error && <p className="text-xs font-semibold text-[#B91C1C] mt-3">{error}</p>}
          </div>
        </div>
      </Card>

      {showWinback && (
        <Card padding="lg" className="border-2 border-[#E7F256] bg-[#FBFDDC]">
          <div className="flex items-start gap-4">
            <Sparkles className="w-7 h-7 text-[#121212] shrink-0 mt-1" />
            <div className="flex-1">
              <Badge variant="mono" size="sm" className="mb-2">ONE-TIME RETURN OFFER</Badge>
              <h2 className="text-xl font-extrabold">Come back for 50% off</h2>
              <p className="text-sm text-[#555555] mt-1">
                Pay ${(total / 2).toFixed(2)} for your {cycleLabel}. After that, renewal returns to the regular ${total.toFixed(2)} rate.
              </p>
              <Button
                variant="dark"
                size="lg"
                className="mt-4"
                isLoading={loading === "winback_50"}
                onClick={onWinback}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Claim 50% off
              </Button>
            </div>
          </div>
        </Card>
      )}

      <LockedPreview trackedCount={trackedCount} />
    </section>
  );
}

function LockedPreview({
  trackedCount,
  mode = "renew",
}: {
  trackedCount: number;
  mode?: "renew" | "subscribe";
}) {
  return (
      <div className="relative overflow-hidden rounded-2xl border border-[#E2E2DC] bg-white min-h-[360px]">
        <div className="p-6 space-y-4 blur-[7px] opacity-55 pointer-events-none select-none" aria-hidden="true">
          <div className="h-6 w-48 rounded bg-[#D9D9D2]" />
          {Array.from({ length: Math.max(1, Math.min(trackedCount, 3)) }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 rounded-xl border border-[#E2E2DC] p-5">
              <div className="w-12 h-12 rounded-full bg-[#CFCFC8]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-[#CFCFC8]" />
                <div className="h-3 w-56 rounded bg-[#E2E2DC]" />
              </div>
              <div className="h-9 w-20 rounded-full bg-[#D9D9D2]" />
            </div>
          ))}
          <div className="grid sm:grid-cols-3 gap-3 pt-3">
            <div className="h-24 rounded-xl bg-[#E2E2DC]" />
            <div className="h-24 rounded-xl bg-[#E2E2DC]" />
            <div className="h-24 rounded-xl bg-[#E2E2DC]" />
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/25">
          <div className="rounded-2xl bg-white/95 border border-[#E2E2DC] shadow-lg px-7 py-6 text-center max-w-sm mx-4">
            <Lock className="w-7 h-7 mx-auto mb-2" />
            <p className="font-extrabold">
              {mode === "renew" ? "Renew" : "Subscribe"} to reveal your dashboard
            </p>
            <p className="text-xs text-[#555555] mt-1">
              {trackedCount > 0
                ? `${trackedCount} tracked ${trackedCount === 1 ? "account is" : "accounts are"} safely preserved.`
                : "Your saved dashboard will appear here after renewal."}
            </p>
          </div>
        </div>
      </div>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#555555] mb-2">{label}</p>
      <div className="inline-flex rounded-full border border-[#D9D9D2] bg-white p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              value === option.value ? "bg-[#121212] text-white" : "text-[#555555]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
