"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  Activity,
  Save,
  Download,
  RefreshCw,
  Users,
  CreditCard,
} from "lucide-react";
import { Button, Badge, Card } from "@/design-system";
import { track, identify } from "@/lib/mixpanel";
import { BillingManagement } from "@/components/account/billing-management";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { AppShell } from "@/components/app/app-shell";
import { SubscriptionPlanPicker } from "@/components/subscription/subscription-plan-picker";
import {
  AccountDataRequestError,
  useAccountData,
} from "@/lib/account-data-client";

type RenewalCadence = "weekly" | "quarterly";
type RenewalTier = "base" | "premium";

export default function AccountPage() {
  const router = useRouter();
  const { data, loading, error: loadError, refresh, update } = useAccountData();
  const [error, setError] = useState("");
  const [spikeThresholdOverride, setSpikeThreshold] = useState<number | null>(null);
  const [savingSpike, setSavingSpike] = useState(false);
  const [spikeSaved, setSpikeSaved] = useState(false);
  const [renewalCadenceOverride, setRenewalCadence] = useState<RenewalCadence | null>(null);
  const [renewalTierOverride, setRenewalTier] = useState<RenewalTier | null>(null);
  const [renewalEmailAlertsOverride, setRenewalEmailAlerts] = useState<boolean | null>(null);
  const [showWinbackOffer, setShowWinbackOffer] = useState(false);
  const [renewalLoading, setRenewalLoading] = useState<"standard" | "winback_50" | null>(null);
  const [renewalError, setRenewalError] = useState("");
  const [renewalSuccess, setRenewalSuccess] = useState(false);
  const [accountsToAdd, setAccountsToAdd] = useState(1);
  const [addingCapacity, setAddingCapacity] = useState(false);
  const [capacityError, setCapacityError] = useState("");
  const trackedView = useRef(false);
  const spikeThreshold = spikeThresholdOverride ?? data?.spikeThreshold ?? 5;
  const renewalCadence =
    renewalCadenceOverride ?? data?.renewalDefaults?.cadence ?? "weekly";
  const renewalTier =
    renewalTierOverride ?? data?.renewalDefaults?.tier ?? "base";
  const renewalEmailAlerts =
    renewalEmailAlertsOverride ?? data?.renewalDefaults?.emailAlerts ?? false;

  useEffect(() => {
    if (!(loadError instanceof AccountDataRequestError)) return;
    if (loadError.status === 401) router.replace("/login?next=/account");
  }, [loadError, router]);

  useEffect(() => {
    if (!data || trackedView.current) return;
    trackedView.current = true;
    identify(data.user.id, { $email: data.user.email ?? undefined });
    track("account_viewed", {
      has_active_subscription: data.hasActiveSubscription,
    });
  }, [data]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("renewal_canceled") !== "1") return;

    const revealOffer = window.setTimeout(() => {
      setShowWinbackOffer(true);
      track("renewal_offer_revealed", {
        offer: "winback_50",
        source: "checkout_abandoned",
      });
      window.history.replaceState({}, "", "/account#renew-subscription");
    }, 0);
    return () => window.clearTimeout(revealOffer);
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const returningFromRenewal = urlParams.get("renewed") === "1";
    const returningFromPurchase = urlParams.get("subscribed") === "1";
    if (!returningFromRenewal && !returningFromPurchase) return;

    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const next = await refresh(true);
          if (cancelled) return;
          if (next.hasActiveSubscription || attempt === 5) {
            if (next.hasActiveSubscription) {
              setRenewalSuccess(true);
              track(
                returningFromRenewal
                  ? "renewal_completed"
                  : "subscription_activated",
                { source: "app" }
              );
            }
            window.history.replaceState({}, "", "/account");
            return;
          }
        } catch (refreshError) {
          if (
            refreshError instanceof AccountDataRequestError &&
            refreshError.status === 401
          ) {
            router.replace("/login?next=/account");
            return;
          }
        }
        if (attempt < 5) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, router]);

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
        update((current) => ({
          ...current,
          spikeThreshold: json.spike_threshold ?? spikeThreshold,
        }));
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

  const addAccountCapacity = async () => {
    if (!data?.capacity || addingCapacity) return;
    setAddingCapacity(true);
    setCapacityError("");

    const previous = data.capacity;
    const desiredAdditionalAccounts =
      previous.additionalAccounts + accountsToAdd;

    try {
      const res = await fetch("/api/stripe/account-capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additionalAccounts: desiredAdditionalAccounts,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.paymentUrl) {
          window.location.assign(json.paymentUrl);
          return;
        }
        setCapacityError(json.error || "Could not add account slots");
        return;
      }

      update((current) => ({ ...current, capacity: json.capacity }));
      setAccountsToAdd(1);
    } catch {
      setCapacityError("Network error. Please try again.");
    } finally {
      setAddingCapacity(false);
    }
  };

  const planLabel = (plan: string, tier?: string) => {
    const base = tier === "premium" ? "Premium" : "Basic";
    return plan === "pro" ? `${base} (with email alerts)` : base;
  };

  if (loading && !data) {
    return <AccountSkeleton />;
  }

  return (
    <AppShell>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 space-y-6">
        {/* Account header */}
        <div>
          <Badge variant="mono" size="sm" className="mb-3">
            ACCOUNT SETTINGS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212]">
            {data?.user.email || "Account"}
          </h1>
          <p className="text-sm text-[#555555] mt-1 font-medium">
            Billing, concurrent slots, alerts, and add-on credits.
          </p>
        </div>

        {(error || loadError) && (
          <Card variant="subtle" className="border-[#FCA5A5]">
            <p className="text-sm text-[#B91C1C] font-medium">{error || loadError?.message}</p>
          </Card>
        )}

        {renewalSuccess && (
          <Card variant="highlight" className="border-[#86EFAC]">
            <p className="text-sm font-bold text-[#047857]">
              Subscription active. Open the dashboard to see tracked accounts.
            </p>
          </Card>
        )}

        {/* Subscription status */}
        <Card
          variant={data?.hasActiveSubscription ? "highlight" : "subtle"}
          padding="lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  data?.hasActiveSubscription
                    ? "bg-[#121212] text-[#E7F256] dark:bg-[#E7F256] dark:text-[#121212]"
                    : "bg-[#EDEDE8] text-[#555555] dark:bg-[#222222] dark:text-[#A1A1AA]"
                }`}
              >
                {data?.hasActiveSubscription ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-extrabold text-[var(--foreground)]">
                  {data?.hasActiveSubscription
                    ? "Active subscription"
                    : data?.canRenew
                      ? "Subscription inactive"
                      : "No active subscription"}
                </h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
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
            </div>
            {data?.hasActiveSubscription && (
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full sm:w-auto"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  View tracked accounts
                </Button>
              </Link>
            )}
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
            onPlanChanged={({
              cadence: nextCadence,
              tier: nextTier,
              emailAlerts: nextEmailAlerts,
            }) =>
              update((current) => ({
                ...current,
                capacity: current.capacity
                  ? {
                      ...current.capacity,
                      cadence: nextCadence,
                      tier: nextTier,
                      includedAccounts: nextTier === "premium" ? 5 : 3,
                      totalAccounts:
                        (nextTier === "premium" ? 5 : 3) +
                        current.capacity.additionalAccounts,
                      unitAmount: nextCadence === "weekly" ? 100 : 1400,
                    }
                  : current.capacity,
                subscriptions: current.subscriptions.map((subscription) => ({
                  ...subscription,
                  tier: nextTier,
                  plan: nextEmailAlerts ? "pro" : "basic",
                })),
              }))
            }
          />
        )}

        {data?.hasActiveSubscription ? (
          <>
        {/* Concurrent account capacity */}
        {data.capacity && (
          <Card variant="subtle" padding="lg">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#121212] text-[#E7F256] flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#121212]">
                    Concurrent account capacity
                  </h2>
                  <p className="text-sm text-[#555555] mt-0.5">
                    <strong className="text-[#121212]">
                      {data.capacity.activeAccounts} of {data.capacity.totalAccounts}
                    </strong>{" "}
                    slots in use · {data.capacity.includedAccounts} included with {data.capacity.tier === "premium" ? "Premium" : "Basic"}
                  </p>
                  <p className="text-xs text-[#777777] mt-1">
                    Pause any tracked account to free its slot. Add as many concurrent slots as you need.
                  </p>
                  <p className="text-xs font-semibold text-[#777777] mt-1">
                    Additional slots share your existing scan-credit balance; they do not add scan credits.
                  </p>
                </div>
              </div>

              <div className="sm:min-w-[250px] rounded-xl border border-[#D9D9D2] bg-white p-4">
                <label className="text-xs font-bold uppercase tracking-wide text-[#555555]">
                  Add account slots
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={accountsToAdd}
                    onChange={(event) =>
                      setAccountsToAdd(
                        Math.min(50, Math.max(1, Number(event.target.value) || 1))
                      )
                    }
                    className="w-20 rounded-lg border border-[#D9D9D2] bg-white px-3 py-2 text-base font-extrabold text-[#121212] outline-none focus:border-[#121212]"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addAccountCapacity}
                    isLoading={addingCapacity}
                    className="flex-1"
                  >
                    Add {accountsToAdd}
                  </Button>
                </div>
                <p className="text-xs font-semibold text-[#047857] mt-2">
                  +${((data.capacity.unitAmount * accountsToAdd) / 100).toFixed(2)}{data.capacity.cadence === "weekly" ? "/week" : "/quarter"}
                </p>
                <p className="text-[11px] text-[#777777] mt-0.5">
                  New capacity: {data.capacity.totalAccounts + accountsToAdd} concurrent accounts. Prorated today.
                </p>
                {capacityError && (
                  <p className="text-xs font-semibold text-[#B91C1C] mt-2">
                    {capacityError}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

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

        {/* Scan balance + one-time add-ons */}
        <Card variant="subtle" padding="lg">
          <h2 className="text-base font-extrabold text-[#121212] mb-1">Credits and add-ons</h2>
          <p className="text-xs text-[#555555] mb-4">
            Automatic monitoring uses the weekly plan pool. Purchased rescan credits are separate and never expire.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#E2E2DC] bg-white p-4 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-[#121212] shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-[#121212]">
                  {data?.credits?.rescan_credits ?? 0} {(data?.credits?.rescan_credits ?? 0) === 1 ? "credit" : "credits"}
                </div>
                <div className="text-xs text-[#555555]">
                  On-demand rescans
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[#E2E2DC] bg-white p-4 flex items-center gap-3">
              <Download className="w-5 h-5 text-[#121212] shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-[#121212]">
                  {data?.credits?.unlimited_export
                    ? "Unlimited Forever"
                    : `${data?.credits?.export ?? 0} left`}
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
            onCadenceChange={(value) => {
              setRenewalCadence(value);
              track("billing_cadence_selected", { cadence: value, source: "renewal" });
            }}
            onTierChange={(value) => {
              setRenewalTier(value);
              track("plan_tier_selected", { tier: value, source: "renewal" });
            }}
            onEmailAlertsChange={(value) => {
              setRenewalEmailAlerts(value);
              track("email_alerts_toggled", {
                state: value ? "on" : "off",
                cadence: renewalCadence,
                source: "renewal",
              });
            }}
            onRenew={() => startRenewal("standard")}
            onDecline={() => {
              setShowWinbackOffer(true);
              track("renewal_offer_revealed", { offer: "winback_50" });
            }}
            onWinback={() => startRenewal("winback_50")}
          />
        )}
      </main>
    </AppShell>
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
      ? cadence === "weekly" ? 12.99 : 129
      : cadence === "weekly" ? 9.99 : 99;
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
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#121212] text-[#E7F256]">
          <CreditCard className="h-5 w-5" />
        </div>
        <Badge variant="lime" size="sm" className="mb-3">
          {showWinback ? "ONE-TIME RETURN OFFER" : "REACTIVATE YOUR ACCOUNT"}
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {showWinback ? "Come back for 50% off" : "Renew your subscription"}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm font-medium text-[#555555] sm:text-base">
          {showWinback
            ? `Choose the plan you want and pay half price for your ${cycleLabel}. Your saved history and monitoring resume immediately.`
            : "Your history is preserved. Choose what you need, then renewal reveals it again and resumes every-other-day monitoring."}
        </p>
      </div>

      <SubscriptionPlanPicker
        cadence={cadence}
        tier={tier}
        emailAlerts={emailAlerts}
        discountPercent={showWinback ? 50 : undefined}
        onTierChange={onTierChange}
        onCadenceChange={onCadenceChange}
        onEmailAlertsChange={onEmailAlertsChange}
      >
        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:flex-1"
            isLoading={loading === (showWinback ? "winback_50" : "standard")}
            onClick={showWinback ? onWinback : onRenew}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            {showWinback ? `Renew for $${(total / 2).toFixed(2)} · 50% off` : "Continue to secure checkout"}
          </Button>
          {!showWinback ? (
            <button
              type="button"
              onClick={onDecline}
              className="px-3 text-sm font-bold text-[#555555] underline underline-offset-2"
            >
              Not right now
            </button>
          ) : null}
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-[#6B6B66]">
          <Lock className="h-3.5 w-3.5" /> Cancel anytime from your account. Payments handled by Stripe.
        </p>
      </SubscriptionPlanPicker>

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
