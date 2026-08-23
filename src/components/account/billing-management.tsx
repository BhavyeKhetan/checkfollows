"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CreditCard,
  ExternalLink,
  FileText,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Badge, Button, Card } from "@/design-system";
import { track } from "@/lib/mixpanel";
import { CancellationFlow } from "./cancellation-flow";

type Cadence = "weekly" | "quarterly";
type Tier = "base" | "premium";

interface BillingData {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  pauseResumesAt: string | null;
  cadence: Cadence;
  tier: Tier;
  emailAlerts: boolean;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  retentionDiscountUsed: boolean;
  pauseOfferUsed: boolean;
  invoices: Array<{
    id: string;
    createdAt: string;
    amountPaid: number;
    currency: string;
    status: string | null;
    url: string | null;
  }>;
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
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPlan, setShowPlan] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [tier, setTier] = useState<Tier>("base");
  const [emailAlerts, setEmailAlerts] = useState(false);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/account/billing", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error || "Billing details could not be loaded.");
        return;
      }
      const next = json.subscription as BillingData | null;
      setBilling(next);
      if (next) {
        setCadence(next.cadence);
        setTier(next.tier);
        setEmailAlerts(next.emailAlerts);
      }
    } catch {
      setError("Billing details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBilling(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBilling]);

  const price = useMemo(() => {
    const base =
      tier === "premium"
        ? cadence === "weekly" ? 12.99 : 129
        : cadence === "weekly" ? 9.99 : 99;
    return base + (emailAlerts ? (cadence === "weekly" ? 2 : 10) : 0);
  }, [cadence, tier, emailAlerts]);

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
        onPlanChanged?.({ cadence, tier, emailAlerts });
      } else {
        track("subscription_reactivated");
        setNotice("Your scheduled cancellation has been removed.");
      }
      await loadBilling();
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
        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-700 dark:text-rose-400">{error}</p>
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
                <span className="block text-sm font-extrabold text-[var(--foreground)]">Change subscription</span>
                <span className="block text-xs text-[var(--muted-foreground)]">Upgrade, downgrade, or change billing</span>
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
            <h3 className="font-extrabold text-[var(--foreground)]">Choose your subscription</h3>
            <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
              Stripe applies prorated charges or credits when the change takes effect.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <OptionGroup
                label="Plan"
                value={tier}
                options={[["base", "Basic"], ["premium", "Premium"]]}
                onChange={(value) => setTier(value as Tier)}
              />
              <OptionGroup
                label="Billing"
                value={cadence}
                options={[["weekly", "Weekly"], ["quarterly", "Every 3 months"]]}
                onChange={(value) => setCadence(value as Cadence)}
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm font-bold text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(event) => setEmailAlerts(event.target.checked)}
                className="h-4 w-4 accent-[#E7F256]"
              />
              Include email change alerts
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-2xl font-extrabold text-[var(--foreground)]">${price.toFixed(2)}</span>
                <span className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">{cadence === "weekly" ? "/week" : "/3 months"}</span>
              </div>
              <Button
                variant="primary"
                isLoading={actionLoading === "change_plan"}
                onClick={() => manageAction("change_plan", { cadence, tier, email_alerts: emailAlerts })}
              >
                Confirm plan change
              </Button>
            </div>
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
        currentPeriodEnd={billing.currentPeriodEnd}
        discountUsed={billing.retentionDiscountUsed}
        pauseUsed={billing.pauseOfferUsed}
        onClose={() => setShowCancel(false)}
        onOpenPlan={() => setShowPlan(true)}
        onChanged={(message) => {
          setNotice(message);
          void loadBilling();
        }}
      />
    </>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--muted-foreground)]">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`flex items-center justify-between rounded-xl border p-3 text-sm font-bold transition-colors ${
              value === option
                ? "border-[#E7F256] bg-[#E7F256]/20 text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {text}
            {value === option && <Check className="h-4 w-4 text-[var(--foreground)]" />}
          </button>
        ))}
      </div>
    </div>
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
