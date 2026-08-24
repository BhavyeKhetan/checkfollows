"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CreditCard,
  ExternalLink,
  FileText,
  RefreshCw,
  Settings2,
  Zap,
} from "lucide-react";
import { Badge, Button, Card } from "@/design-system";
import { track } from "@/lib/mixpanel";
import { CancellationFlow } from "./cancellation-flow";
import { useBillingData } from "@/lib/billing-data-client";

type Cadence = "weekly" | "quarterly";
type Tier = "base" | "premium";

const BASE_PRICE: Record<Cadence, number> = { weekly: 9.99, quarterly: 99 };
const PREMIUM_PRICE: Record<Cadence, number> = { weekly: 12.99, quarterly: 129 };
const ALERTS_ADDON: Record<Cadence, number> = { weekly: 2, quarterly: 10 };

function livePrice(cadence: Cadence, emailAlerts: boolean, planTier: Tier): number {
  const base = planTier === "premium" ? PREMIUM_PRICE[cadence] : BASE_PRICE[cadence];
  return base + (emailAlerts ? ALERTS_ADDON[cadence] : 0);
}

function anchorPrice(cadence: Cadence, emailAlerts: boolean, planTier: Tier): string {
  if (cadence === "quarterly") {
    const weeklyPrice =
      planTier === "premium" ? (emailAlerts ? 14.99 : 12.99) : (emailAlerts ? 11.99 : 9.99);
    return `$${weeklyPrice.toFixed(2)}`;
  }
  if (planTier === "premium") {
    return emailAlerts ? "$37.49" : "$32.49";
  }
  return emailAlerts ? "$29.99" : "$24.99";
}

export function BillingManagement({
  onPlanChanged,
}: {
  onPlanChanged?: (selection: {
    cadence: Cadence;
    tier: Tier;
    emailAlerts: boolean;
  }) => void;
}) {
  const { data: billing, loading, error: loadError, refresh } = useBillingData();
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPlan, setShowPlan] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cadenceOverride, setCadence] = useState<Cadence | null>(null);
  const [tierOverride, setTier] = useState<Tier | null>(null);
  const [emailAlertsOverride, setEmailAlerts] = useState<boolean | null>(null);
  const cadence = cadenceOverride ?? billing?.cadence ?? "weekly";
  const tier = tierOverride ?? billing?.tier ?? "base";
  const emailAlerts = emailAlertsOverride ?? billing?.emailAlerts ?? false;

  const price = useMemo(
    () => livePrice(cadence, emailAlerts, tier),
    [cadence, tier, emailAlerts]
  );
  const currentTier = billing?.tier ?? "base";
  const currentCadence = billing?.cadence ?? "weekly";
  const currentEmailAlerts = billing?.emailAlerts ?? false;
  const isUnchanged =
    tier === currentTier && cadence === currentCadence && emailAlerts === currentEmailAlerts;
  const isDowngrade = currentTier === "premium" && tier === "base";
  const isUpgrade = currentTier === "base" && tier === "premium";
  const isCadenceUpgrade = currentCadence === "weekly" && cadence === "quarterly";
  const isCadenceDowngrade = currentCadence === "quarterly" && cadence === "weekly";
  const showLaunchDiscount =
    currentTier === "base" && (tier === "premium" || cadence === "quarterly");
  const frameAsCheaper = cadence === "quarterly" && !isDowngrade;

  const manageAction = async (
    action: "change_plan" | "reactivate",
    body: Record<string, unknown> = {}
  ) => {
    setActionLoading(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/stripe/subscription/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error || "The subscription could not be updated.");
        return;
      }
      if (action === "change_plan") {
        track("subscription_plan_changed", { cadence, tier, email_alerts: emailAlerts });
        setNotice("Your subscription plan has been updated.");
        setShowPlan(false);
        setCadence(null);
        setTier(null);
        setEmailAlerts(null);
        onPlanChanged?.({ cadence, tier, emailAlerts });
      } else {
        track("subscription_reactivated");
        setNotice("Your scheduled cancellation has been removed.");
      }
      await refresh(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading("");
    }
  };

  const openPortal = async () => {
    setActionLoading("portal");
    setError("");
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.url) {
        setError(json.error || "Billing management could not be opened.");
        return;
      }
      track("billing_portal_opened");
      window.location.assign(json.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading("");
    }
  };

  if (loading) {
    return (
      <Card variant="subtle" padding="lg">
        <div className="flex items-center gap-3 text-sm font-bold text-[#555555]">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading billing details…
        </div>
      </Card>
    );
  }
  if (!billing) return null;
  const canChangePlan = billing.status === "active" || billing.status === "trialing";
  const canManageRenewal = ["active", "trialing", "past_due", "unpaid", "paused"].includes(
    billing.status
  );

  return (
    <>
      <Card variant="subtle" padding="lg">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <h2 className="text-lg font-extrabold">Subscription & billing</h2>
            </div>
            <p className="mt-1 text-sm font-medium text-[#555555]">
              {billing.tier === "premium" ? "Premium" : "Basic"} · {billing.cadence === "weekly" ? "weekly" : "every 3 months"}
              {billing.emailAlerts ? " · email alerts included" : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={billing.cancelAtPeriodEnd ? "mono" : "lime"} size="sm">
                {billing.cancelAtPeriodEnd ? "CANCELLATION SCHEDULED" : billing.status.toUpperCase()}
              </Badge>
              {billing.pauseResumesAt && (
                <Badge variant="mono" size="sm">BILLING BREAK ACTIVE</Badge>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#555555] sm:justify-end">
              <CalendarDays className="h-3.5 w-3.5" />
              {billing.cancelAtPeriodEnd ? "Access until" : "Current period ends"}
            </div>
            <div className="mt-1 text-sm font-extrabold">{formatDate(billing.currentPeriodEnd)}</div>
          </div>
        </div>

        {billing.pauseResumesAt && (
          <p className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm font-semibold text-blue-700 dark:text-blue-400">
            Your 30-day billing break ends {formatDate(billing.pauseResumesAt)}. Access and monitoring remain active.
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">{notice}</p>
        )}
        {(error || loadError) && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-700 dark:text-rose-400">{error || loadError}</p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {canChangePlan && (
            <button
              type="button"
              onClick={() => setShowPlan((value) => !value)}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] p-4 text-left text-[var(--foreground)] transition-colors"
            >
              <Settings2 className="h-5 w-5 text-[var(--foreground)]" />
              <span className="flex-1">
                <span className="block text-sm font-extrabold text-[var(--foreground)]">
                  {billing.tier === "base" ? "Upgrade your subscription" : "Change subscription"}
                </span>
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {billing.tier === "base"
                    ? "Premium is still on your launch price"
                    : "Change billing cadence or email alerts"}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
          )}
          <button
            type="button"
            onClick={openPortal}
            disabled={actionLoading === "portal"}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] p-4 text-left text-[var(--foreground)] disabled:opacity-60 transition-colors"
          >
            <CreditCard className="h-5 w-5 text-[var(--foreground)]" />
            <span className="flex-1">
              <span className="block text-sm font-extrabold text-[var(--foreground)]">Payment & invoices</span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                {billing.paymentMethod
                  ? `${billing.paymentMethod.brand.toUpperCase()} •••• ${billing.paymentMethod.last4}`
                  : "Manage payment method securely"}
              </span>
            </span>
            <ExternalLink className="h-4 w-4 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {showPlan && (
          <div className="mt-5 rounded-2xl border-2 border-[var(--border)] bg-[var(--background-subtle)] p-4 sm:p-5 text-[var(--foreground)]">
            {currentTier === "base" ? (
              <>
                <h3 className="font-extrabold text-[var(--foreground)]">Upgrade to Premium</h3>
                <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
                  Your launch price is still on. More slots, more credits, delete anytime — without looking like a new customer.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-extrabold text-[var(--foreground)]">You&apos;re on Premium</h3>
                <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
                  Keep the extra slots, credits, and delete-anytime access. Basic is a worse plan.
                </p>
              </>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PlanCard
                plan="premium"
                selected={tier === "premium"}
                current={currentTier === "premium"}
                mode={currentTier === "base" ? "upgrade" : "downgrade"}
                cadence={cadence}
                emailAlerts={emailAlerts}
                onSelect={() => {
                  setTier("premium");
                  track("plan_tier_selected", { tier: "premium", source: "account" });
                }}
              />
              <PlanCard
                plan="base"
                selected={tier === "base"}
                current={currentTier === "base"}
                mode={currentTier === "base" ? "upgrade" : "downgrade"}
                cadence={cadence}
                emailAlerts={emailAlerts}
                onSelect={() => {
                  setTier("base");
                  track("plan_tier_selected", { tier: "base", source: "account" });
                }}
              />
            </div>

            {currentTier === "base" && (
              <div className="mt-3 rounded-xl border border-[#E7F256]/50 bg-[#E7F256]/10 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--muted-foreground)]">
                  What you gain on Premium
                </p>
                <ul className="mt-1.5 space-y-1.5 text-xs font-semibold text-[var(--foreground)]">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--foreground)]" />
                    Upgrade for ${cadence === "weekly" ? "3 more per week" : "30 more every 3 months"}
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--foreground)]" />
                    2 extra account slots (5 vs 3) and 18 vs 12 weekly scan credits
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--foreground)]" />
                    Pause, resume, or delete anytime — no 7-day wait
                  </li>
                </ul>
              </div>
            )}

            {isDowngrade && (
              <div className="mt-3 rounded-xl border border-rose-400/50 bg-rose-500/10 p-3">
                <p className="flex items-start gap-2 text-sm font-extrabold text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Basic is a worse plan. You keep paying, you just get less.
                </p>
                <ul className="mt-2 space-y-1 pl-6 text-xs font-semibold text-rose-800/90 dark:text-rose-300/90">
                  <li>5 → 3 concurrent accounts</li>
                  <li>18 → 12 weekly scan credits</li>
                  <li>Delete anytime → once every 7 days</li>
                </ul>
              </div>
            )}

            <div className="mt-4">
              <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--muted-foreground)]">
                Billing
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CadenceOption
                  cadence="weekly"
                  selected={cadence === "weekly"}
                  current={currentCadence}
                  onSelect={() => {
                    setCadence("weekly");
                    track("billing_cadence_selected", { cadence: "weekly", source: "account" });
                  }}
                />
                <CadenceOption
                  cadence="quarterly"
                  selected={cadence === "quarterly"}
                  current={currentCadence}
                  onSelect={() => {
                    setCadence("quarterly");
                    track("billing_cadence_selected", { cadence: "quarterly", source: "account" });
                  }}
                />
              </div>
              {isCadenceUpgrade && (
                <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Save ~24% vs weekly. This is cheaper than paying every week.
                </p>
              )}
              {isCadenceDowngrade && (
                <p className="mt-2 text-xs font-bold text-rose-700 dark:text-rose-400">
                  Weekly costs more per week. Worse value than every 3 months.
                </p>
              )}
            </div>

            <label className="mt-4 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm font-bold text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(event) => {
                  const next = event.target.checked;
                  setEmailAlerts(next);
                  track("email_alerts_toggled", {
                    state: next ? "on" : "off",
                    cadence,
                    source: "account",
                  });
                }}
                className="h-4 w-4 accent-[#E7F256]"
              />
              Include email change alerts
              <span className="ml-auto text-xs font-bold text-[var(--muted-foreground)]">
                {cadence === "weekly" ? "+$2/week" : "+$10/3 months"}
              </span>
            </label>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {showLaunchDiscount && (
                  <div className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Your launch price · 60% off
                  </div>
                )}
                <div className="flex flex-wrap items-baseline gap-2">
                  {showLaunchDiscount && (
                    <span className="text-sm font-bold text-[#999999] line-through decoration-[#B91C1C]/70">
                      {anchorPrice(cadence, emailAlerts, tier)}
                      {cadence === "quarterly" ? "/week" : ""}
                    </span>
                  )}
                  <span className="text-2xl font-extrabold text-[var(--foreground)]">
                    {frameAsCheaper ? `$${(price / 13).toFixed(2)}` : `$${price.toFixed(2)}`}
                  </span>
                  <span className="text-xs font-bold text-[var(--muted-foreground)]">
                    {frameAsCheaper || cadence === "weekly" ? "/week" : "/3 months"}
                  </span>
                </div>
                {cadence === "quarterly" && (
                  <p className="mt-0.5 text-xs font-semibold text-[var(--muted-foreground)]">
                    ${price.toFixed(2)} billed every 3 months
                    {isCadenceUpgrade ? " · save ~24% vs weekly" : ""}
                  </p>
                )}
              </div>

              {isDowngrade ? (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                  <Button
                    variant="primary"
                    className="w-full sm:w-auto"
                    onClick={() => setTier(null)}
                  >
                    Stay on Premium
                  </Button>
                  <button
                    type="button"
                    disabled={actionLoading === "change_plan"}
                    onClick={() =>
                      manageAction("change_plan", { cadence, tier, email_alerts: emailAlerts })
                    }
                    className="w-full rounded-full px-4 py-2.5 text-sm font-bold text-rose-700 underline decoration-rose-400/50 underline-offset-4 hover:text-rose-800 disabled:opacity-60 sm:w-auto dark:text-rose-300 dark:hover:text-rose-200"
                  >
                    {actionLoading === "change_plan" ? "Downgrading…" : "Downgrade to Basic anyway"}
                  </button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  className="w-full sm:w-auto"
                  disabled={isUnchanged}
                  isLoading={actionLoading === "change_plan"}
                  onClick={() =>
                    manageAction("change_plan", { cadence, tier, email_alerts: emailAlerts })
                  }
                >
                  {confirmLabel({
                    isUpgrade,
                    isCadenceUpgrade,
                    isCadenceDowngrade,
                    emailAlertsChanged: emailAlerts !== currentEmailAlerts,
                  })}
                </Button>
              )}
            </div>
            <p className="mt-3 text-[11px] font-medium text-[var(--muted-foreground)]">
              Stripe applies prorated charges or credits when the change takes effect.
            </p>
          </div>
        )}

        {billing.invoices.length > 0 && (
          <div className="mt-6 border-t border-[var(--border)] pt-5">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[var(--foreground)]"><FileText className="h-4 w-4" /> Recent invoices</h3>
            <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {billing.invoices.slice(0, 3).map((invoice) => (
                <div key={invoice.id} className="flex items-center gap-3 p-3 text-sm">
                  <span className="flex-1 font-medium text-[var(--muted-foreground)]">{formatDate(invoice.createdAt)}</span>
                  <span className="font-extrabold text-[var(--foreground)]">{formatMoney(invoice.amountPaid, invoice.currency)}</span>
                  {invoice.url && (
                    <a href={invoice.url} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2 text-[var(--foreground)] hover:text-[#E7F256]">View</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {canManageRenewal && (
        <div className="mt-6 border-t border-[var(--border)] pt-5">
          {billing.cancelAtPeriodEnd ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[var(--muted-foreground)]">Changed your mind? Restore automatic renewal before access ends.</p>
              <Button
                variant="secondary"
                isLoading={actionLoading === "reactivate"}
                onClick={() => manageAction("reactivate")}
              >
                Keep subscription active
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="text-sm font-bold text-red-600 dark:text-red-400 underline decoration-red-400/50 underline-offset-4 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              Review cancellation options
            </button>
          )}
        </div>
        )}
      </Card>

      <CancellationFlow
        open={showCancel}
        cadence={billing.cadence}
        currentTier={billing.tier}
        currentPeriodEnd={billing.currentPeriodEnd}
        discountUsed={billing.retentionDiscountUsed}
        pauseUsed={billing.pauseOfferUsed}
        onClose={() => setShowCancel(false)}
        onOpenPlan={() => setShowPlan(true)}
        onChanged={(message) => {
          setNotice(message);
          void refresh(true);
        }}
      />
    </>
  );
}

function confirmLabel({
  isUpgrade,
  isCadenceUpgrade,
  isCadenceDowngrade,
  emailAlertsChanged,
}: {
  isUpgrade: boolean;
  isCadenceUpgrade: boolean;
  isCadenceDowngrade: boolean;
  emailAlertsChanged: boolean;
}): string {
  if (isUpgrade && isCadenceUpgrade) return "Upgrade to Premium · every 3 months";
  if (isUpgrade) return "Upgrade to Premium";
  if (isCadenceUpgrade) return "Switch to every 3 months";
  if (isCadenceDowngrade) return "Switch to weekly billing";
  if (emailAlertsChanged) return "Update email alerts";
  return "Confirm plan change";
}

function PlanCard({
  plan,
  selected,
  current,
  mode,
  cadence,
  emailAlerts,
  onSelect,
}: {
  plan: Tier;
  selected: boolean;
  current: boolean;
  mode: "upgrade" | "downgrade";
  cadence: Cadence;
  emailAlerts: boolean;
  onSelect: () => void;
}) {
  const isPremium = plan === "premium";
  const amount = livePrice(cadence, emailAlerts, plan);
  const period = cadence === "weekly" ? "/week" : "/3 months";
  const upgradeHighlight = mode === "upgrade" && isPremium;
  const downgradeMute = mode === "downgrade" && !isPremium;

  let cardClass =
    "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]";
  if (mode === "upgrade" && isPremium) {
    cardClass = selected
      ? "border-[#E7F256] bg-[#E7F256]/20 text-[var(--foreground)] shadow-[0_4px_20px_rgba(231,242,86,0.28)]"
      : "border-[#E7F256]/55 bg-[var(--surface)] text-[var(--foreground)] hover:bg-[#E7F256]/10";
  } else if (mode === "upgrade" && !isPremium) {
    cardClass = selected
      ? "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
      : "border-[var(--border)] bg-[var(--background-subtle)] text-[var(--muted-foreground)] opacity-80 hover:opacity-100";
  } else if (mode === "downgrade" && isPremium) {
    cardClass = selected
      ? "border-[#E7F256] bg-[#E7F256]/20 text-[var(--foreground)]"
      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]";
  } else {
    cardClass = selected
      ? "border-rose-400/60 bg-rose-500/5 text-[var(--foreground)]"
      : "border-[var(--border)] bg-[var(--background-subtle)] text-[var(--muted-foreground)] opacity-80 hover:opacity-100";
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col rounded-xl border-2 p-3.5 text-left transition-colors ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm font-extrabold ${downgradeMute ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}>
              {isPremium ? "Premium" : "Basic"}
            </span>
            {current && (
              <Badge variant="muted" size="sm">Current</Badge>
            )}
          </div>
          {upgradeHighlight && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Badge variant="lime" size="sm">
                <Zap className="h-3 w-3" /> Best value
              </Badge>
              <Badge variant="lime" size="sm">60% off</Badge>
            </div>
          )}
        </div>
        {selected && (
          <Check className={`h-4 w-4 shrink-0 ${downgradeMute ? "text-rose-500" : "text-[var(--foreground)]"}`} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
        {upgradeHighlight && (
          <span className="text-xs font-bold text-[#999999] line-through decoration-[#B91C1C]/70">
            {anchorPrice(cadence, emailAlerts, plan)}
            {cadence === "quarterly" ? "/wk" : ""}
          </span>
        )}
        <span className={`text-xl font-extrabold ${downgradeMute ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}>
          {cadence === "quarterly" && upgradeHighlight
            ? `$${(amount / 13).toFixed(2)}`
            : `$${amount.toFixed(2)}`}
        </span>
        <span className="text-[11px] font-bold text-[var(--muted-foreground)]">
          {cadence === "quarterly" && upgradeHighlight ? "/week" : period}
        </span>
      </div>
      {upgradeHighlight && cadence === "quarterly" && (
        <p className="mt-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          ${amount.toFixed(2)} / 3 months · save ~24% vs weekly
        </p>
      )}
      {upgradeHighlight && cadence === "weekly" && (
        <p className="mt-0.5 text-[11px] font-bold text-[var(--muted-foreground)]">Your launch price</p>
      )}

      <ul className={`mt-3 space-y-1 text-[11px] font-semibold ${downgradeMute ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}>
        {isPremium ? (
          <>
            <li>5 concurrent accounts</li>
            <li>18 scan credits / week</li>
            <li>Pause, resume, or delete anytime</li>
          </>
        ) : (
          <>
            <li>3 concurrent accounts</li>
            <li>12 scan credits / week</li>
            <li>Delete a tracked account once every 7 days</li>
          </>
        )}
      </ul>
    </button>
  );
}

function CadenceOption({
  cadence,
  selected,
  current,
  onSelect,
}: {
  cadence: Cadence;
  selected: boolean;
  current: Cadence;
  onSelect: () => void;
}) {
  const isQuarterly = cadence === "quarterly";
  const isDeal = isQuarterly;
  const isWorse = !isQuarterly && current === "quarterly";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center justify-between rounded-xl border p-3 text-sm font-bold transition-colors ${
        selected && isDeal
          ? "border-[#E7F256] bg-[#E7F256]/20 text-[var(--foreground)]"
          : selected
            ? "border-[var(--foreground)]/40 bg-[var(--surface)] text-[var(--foreground)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      <span className="flex flex-col items-start gap-0.5">
        <span>{isQuarterly ? "Every 3 months" : "Weekly"}</span>
        {isDeal && (
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Save ~24%
          </span>
        )}
        {isWorse && (
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--muted-foreground)]">
            More expensive
          </span>
        )}
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-[var(--foreground)]" />}
    </button>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
