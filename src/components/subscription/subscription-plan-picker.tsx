"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { Bell, Check, Sparkles, Zap } from "lucide-react";
import { Badge, Card } from "@/design-system";

export type SubscriptionCadence = "weekly" | "quarterly";
export type SubscriptionTier = "base" | "premium";

const FEATURES = [
  "Complete chronological following list",
  "Free every-other-day Instagram count checks",
  "New-follow & unfollow change alerts",
  "Full history timeline per account",
  "No Instagram login required",
  "Cancel anytime — keep access until period end",
];

export function subscriptionPrice(
  cadence: SubscriptionCadence,
  tier: SubscriptionTier,
  emailAlerts: boolean
) {
  const base = tier === "premium"
    ? cadence === "weekly" ? 12.99 : 129
    : cadence === "weekly" ? 9.99 : 99;
  return base + (emailAlerts ? (cadence === "weekly" ? 2 : 10) : 0);
}

function weeklyRate(amount: number, cadence: SubscriptionCadence) {
  return cadence === "quarterly" ? amount / 13 : amount;
}

function anchorPrice(
  cadence: SubscriptionCadence,
  emailAlerts: boolean,
  tier: SubscriptionTier
) {
  if (cadence === "quarterly") {
    const weeklyPrice = tier === "premium"
      ? emailAlerts ? 14.99 : 12.99
      : emailAlerts ? 11.99 : 9.99;
    return `$${weeklyPrice.toFixed(2)}`;
  }
  if (tier === "premium") return emailAlerts ? "$37.49" : "$32.49";
  return emailAlerts ? "$29.99" : "$24.99";
}

export function SubscriptionPlanPicker({
  cadence,
  tier,
  emailAlerts,
  discountPercent,
  onCadenceChange,
  onTierChange,
  onEmailAlertsChange,
  children,
}: {
  cadence: SubscriptionCadence;
  tier: SubscriptionTier;
  emailAlerts: boolean;
  discountPercent?: number;
  onCadenceChange: (value: SubscriptionCadence) => void;
  onTierChange: (value: SubscriptionTier) => void;
  onEmailAlertsChange: (value: boolean) => void;
  children?: ReactNode;
}) {
  const regularTotal = subscriptionPrice(cadence, tier, emailAlerts);
  const total = discountPercent
    ? regularTotal * (1 - discountPercent / 100)
    : regularTotal;
  const displayWeekly = weeklyRate(total, cadence);
  const alertsWeekly = cadence === "quarterly" ? 10 / 13 : 2;
  const toggleAlerts = () => onEmailAlertsChange(!emailAlerts);
  const handleAlertsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleAlerts();
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center rounded-full border border-[#E2E2DC] bg-[#F9F9F7] p-1">
            <button
              type="button"
              aria-pressed={tier === "base"}
              onClick={() => onTierChange("base")}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                tier === "base" ? "bg-[#121212] text-white" : "text-[#555555] hover:text-[#121212]"
              }`}
            >
              Basic
            </button>
            <button
              type="button"
              aria-pressed={tier === "premium"}
              onClick={() => onTierChange("premium")}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold transition-all ${
                tier === "premium" ? "bg-[#121212] text-white" : "text-[#555555] hover:text-[#121212]"
              }`}
            >
              Premium
              <span className="rounded-full bg-[#E7F256] px-1.5 py-0.5 text-[10px] font-bold text-[#121212]">
                Unlimited
              </span>
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold text-[#777777]">
          {tier === "base" ? "3 concurrent accounts included" : "5 concurrent accounts included"}
        </p>
      </div>

      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-full border border-[#E2E2DC] bg-[#F9F9F7] p-1">
          <button
            type="button"
            aria-pressed={cadence === "weekly"}
            onClick={() => onCadenceChange("weekly")}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
              cadence === "weekly" ? "bg-[#121212] text-white" : "text-[#555555] hover:text-[#121212]"
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            aria-pressed={cadence === "quarterly"}
            onClick={() => onCadenceChange("quarterly")}
            className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold transition-all ${
              cadence === "quarterly" ? "bg-[#121212] text-white" : "text-[#555555] hover:text-[#121212]"
            }`}
          >
            Quarterly
            <span className="rounded-full bg-[#E7F256] px-1.5 py-0.5 text-[10px] font-bold text-[#121212]">
              Save 24%
            </span>
          </button>
        </div>
      </div>

      <Card padding="lg" className="border-2 border-[#E7F256] shadow-[0_4px_20px_rgba(231,242,86,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#121212]">
              {tier === "premium" ? "Premium" : "Basic"} · {cadence === "weekly" ? "Weekly" : "Quarterly"}
            </h2>
            <p className="text-sm text-[#555555]">
              {tier === "base" ? "3 concurrent accounts included" : "5 concurrent accounts included"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="lime" size="sm">
              <Zap className="h-3 w-3" /> {discountPercent ? `${discountPercent}% OFF` : cadence === "quarterly" ? "SAVE 24%" : "60% OFF"}
            </Badge>
            {cadence === "quarterly" ? (
              <Badge variant="lime" size="sm">
                <Sparkles className="h-3 w-3" /> Best value
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-[#999999] line-through decoration-[#B91C1C]/70">
            {discountPercent
              ? `$${weeklyRate(regularTotal, cadence).toFixed(2)}`
              : anchorPrice(cadence, emailAlerts, tier)}
          </span>
          <span className="text-5xl font-extrabold tracking-tight text-[#121212]">
            ${displayWeekly.toFixed(2)}
          </span>
          <span className="text-sm font-semibold text-[#777777]">/week</span>
        </div>
        <p className="mt-2 text-xs text-[#888888]">
          {cadence === "weekly" ? (
            <>{discountPercent ? `$${total.toFixed(2)} first week · then $${regularTotal.toFixed(2)}/week` : "Billed weekly"} · extra slots $1/week each · Cancel anytime</>
          ) : (
            <>
              <strong className="font-extrabold text-[#121212]">${total.toFixed(2)} billed for the first quarter</strong>
              {discountPercent ? ` · then $${regularTotal.toFixed(2)} every 3 months` : " (every 3 months)"} · extra slots $14/quarter each
            </>
          )}
          {emailAlerts ? (
            <span className="text-[11px] font-semibold text-[#047857]"> · includes +${alertsWeekly.toFixed(2)}/wk email alerts</span>
          ) : null}
        </p>

        <div
          role="checkbox"
          tabIndex={0}
          aria-checked={emailAlerts}
          onClick={toggleAlerts}
          onKeyDown={handleAlertsKeyDown}
          className={`mt-5 w-full cursor-pointer rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
            emailAlerts
              ? "border-[#121212] bg-[#E7F256]/15 shadow-sm"
              : "border-[#E2E2DC] bg-[#F9F9F7] hover:border-[#C9C9C0]"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                emailAlerts ? "bg-[#121212] text-[#E7F256]" : "bg-[#EDEDE8] text-[#555555]"
              }`}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold leading-tight text-[#121212] sm:text-base">Email Change Alerts</h3>
                <p className="mt-0.5 text-xs font-bold text-[#047857]">
                  +${alertsWeekly.toFixed(2)}/wk{" "}
                  <span className="font-normal text-[#777777]">
                    ({cadence === "weekly" ? "billed weekly" : "<$1/wk · $10 billed quarterly"})
                  </span>
                </p>
              </div>
            </div>
            <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full ${emailAlerts ? "bg-[#121212]" : "bg-[#D9D9D2]"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${emailAlerts ? "translate-x-6" : "translate-x-1"}`} />
            </span>
          </div>
          <p className="mt-3 border-t border-[#E2E2DC]/80 pt-3 text-xs font-medium leading-relaxed text-[#555555]">
            Get instant notifications the moment they follow or unfollow someone. We check their account every 48 hours and send detailed change alerts straight to your inbox.
          </p>
        </div>

        <ul className="mt-5 space-y-2.5 border-t border-[#E2E2DC] pt-5">
          <Feature>{tier === "premium" ? 18 : 12} scan credits included every week</Feature>
          {FEATURES.map((feature) => <Feature key={feature}>{feature}</Feature>)}
        </ul>

        {children}
      </Card>
    </div>
  );
}

function Feature({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-[#555555]">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#E7F256]">
        <Check className="h-3 w-3 text-[#121212]" strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}
