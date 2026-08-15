"use client";

import { useState, useEffect } from "react";
import { Check, Zap, Shield, Lock, Eye, Bell, History, TrendingUp, Clock } from "lucide-react";
import { Badge, Card } from "@/design-system";
import { track } from "@/lib/mixpanel";
import { CheckoutButton } from "@/components/marketing/checkout-button";
import { FaqList } from "@/components/marketing/faq-list";

type Tier = "base" | "premium";
type Cadence = "weekly" | "quarterly";

const BASE_PRICE: Record<Cadence, number> = { weekly: 9.99, quarterly: 49.99 };
const PREMIUM_PRICE: Record<Cadence, number> = { weekly: 12.99, quarterly: 64.99 };
const ALERTS_ADDON: Record<Cadence, number> = { weekly: 2, quarterly: 10 };

const FEATURES = [
  "Complete chronological following list",
  "Every-other-day monitoring with automatic rescan",
  "New-follow & unfollow change alerts",
  "Full history timeline per account",
  "No Instagram login required",
  "Cancel anytime — keep access until period end",
];

// Fake-anchor "original" price shown struck-through so the live price reads as 60% off.
// Display-only — the actual Stripe charge stays at the discounted price.
function anchorPrice(cadence: Cadence, emailAlerts: boolean, tier: Tier): string {
  if (tier === "premium") {
    if (cadence === "weekly") return emailAlerts ? "$37.49" : "$32.49";
    return emailAlerts ? "$187.49" : "$162.49";
  }
  if (cadence === "weekly") return emailAlerts ? "$29.99" : "$24.99";
  return emailAlerts ? "$149.99" : "$124.99";
}

function livePrice(cadence: Cadence, emailAlerts: boolean, tier: Tier): number {
  const base = tier === "premium" ? PREMIUM_PRICE[cadence] : BASE_PRICE[cadence];
  return base + (emailAlerts ? ALERTS_ADDON[cadence] : 0);
}

const PRICING_FAQS = [
  {
    q: "When do I get charged?",
    a: "You're charged immediately at checkout — then your plan renews every week or every 3 months depending on your cadence. You can cancel anytime, and your access continues until the end of your billing period.",
  },
  {
    q: "What happens after I subscribe?",
    a: "We immediately run a full scan of the account you searched, save it as your baseline, and start monitoring it every 48 hours automatically. You'll see new follows and unfollows as they happen.",
  },
  {
    q: "How many accounts can I track?",
    a: "Basic includes 3 tracked accounts total. Premium lets you track unlimited accounts — up to 5 monitored at a time — so you can watch an ex, a crush, a competitor, or an influencer all in one dashboard.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, 1-click cancellation from your Stripe billing portal. Your access and monitoring continue until the end of your current billing period.",
  },
  {
    q: "Is there a refund policy?",
    a: "Yes. See our Refund Policy for the full terms — we offer refunds for unused service in most cases.",
  },
];

export function Pricing() {
  const [cadence, setCadence] = useState<Cadence>("quarterly");
  const [tier, setTier] = useState<Tier>("base");
  const [emailAlerts, setEmailAlerts] = useState(false);

  useEffect(() => {
    track("pricing_viewed");
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative ramp-grid-bg pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 border-b border-[#E2E2DC]">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          <div className="flex flex-col items-center gap-4 mb-6">
            <Badge variant="mono" size="md">
              SIMPLE PRICING &middot; CANCEL ANYTIME
            </Badge>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#121212] text-[#E7F256] px-5 py-2 text-[11px] sm:text-xs font-extrabold uppercase tracking-widest shadow-md border border-black/20">
              <Zap className="w-3.5 h-3.5" /> 60% OFF LAUNCH PRICING &mdash; THIS WEEK ONLY
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#121212] leading-[1.08]">
            Two plans. <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">Every-other-day monitoring.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-[#555555] max-w-xl mx-auto leading-relaxed font-medium">
            Stop guessing who they follow. Track changes automatically and get
            alerted the moment something happens — no Instagram login required.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#FFFFFF]">
        <div className="max-w-3xl mx-auto">
          {/* Plan tier toggle */}
          <div className="flex items-center justify-center mb-3">
            <div className="inline-flex items-center rounded-full border border-[#E2E2DC] bg-[#F9F9F7] p-1">
              <ToggleBtn
                active={tier === "base"}
                onClick={() => {
                  setTier("base");
                  track("plan_tier_selected", { tier: "base", source: "pricing" });
                }}
                label="Basic"
              />
              <ToggleBtn
                active={tier === "premium"}
                onClick={() => {
                  setTier("premium");
                  track("plan_tier_selected", { tier: "premium", source: "pricing" });
                }}
                label="Premium"
                badge="Unlimited"
              />
            </div>
          </div>
          <p className="text-center text-xs text-[#777777] font-semibold mb-8">
            {tier === "base"
              ? "3 accounts total · monitoring every 48 hours"
              : "Unlimited accounts · 5 at a time · monitoring every 48 hours"}
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center mb-10">
            <div className="inline-flex items-center rounded-full border border-[#E2E2DC] bg-[#F9F9F7] p-1">
              <ToggleBtn
                active={cadence === "weekly"}
                onClick={() => {
                  setCadence("weekly");
                  track("billing_cadence_selected", { cadence: "weekly", source: "pricing" });
                }}
                label="Weekly"
              />
              <ToggleBtn
                active={cadence === "quarterly"}
                onClick={() => {
                  setCadence("quarterly");
                  track("billing_cadence_selected", { cadence: "quarterly", source: "pricing" });
                }}
                label="Quarterly"
                badge="Save 60%"
              />
            </div>
          </div>

          {/* Email alerts upsell */}
          <div className="flex items-center justify-center mb-10">
            <button
              type="button"
              onClick={() =>
                setEmailAlerts((v) => {
                  const next = !v;
                  track("email_alerts_toggled", {
                    state: next ? "on" : "off",
                    cadence,
                    source: "pricing",
                  });
                  return next;
                })
              }
              className="inline-flex items-center gap-3 rounded-full border border-[#E2E2DC] bg-[#F9F9F7] px-5 py-2.5 hover:border-[#C9C9C0] transition-colors"
            >
              <Bell className="w-4 h-4 text-[#121212]" />
              <span className="text-sm font-bold text-[#121212]">Email change alerts</span>
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  emailAlerts ? "bg-[#121212]" : "bg-[#D9D9D2]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    emailAlerts ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
              <span className="text-[11px] font-bold text-[#047857]">
                {cadence === "weekly" ? "+$2/wk" : "+$10/qtr"}
              </span>
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 items-stretch">
            {/* Weekly */}
            <Card
              padding="lg"
              className={`relative flex flex-col ${
                cadence === "weekly" ? "border-2 border-[#E7F256] shadow-[0_4px_20px_rgba(231,242,86,0.35)]" : ""
              }`}
            >
              <Badge variant="lime" size="sm" className="absolute -top-3 right-6">
                <Zap className="w-3 h-3" /> 60% OFF
              </Badge>
              <h3 className="text-lg font-bold text-[#121212]">Weekly</h3>
              <p className="text-sm text-[#555555] mt-0.5">For short-term curiosity</p>
              <div className="mt-6 flex items-baseline gap-2 flex-wrap">
                <span className="text-lg font-bold text-[#999999] line-through decoration-[#B91C1C]/70">
                  {anchorPrice("weekly", emailAlerts, tier)}
                </span>
                <span className="text-5xl font-extrabold tracking-tight text-[#121212]">
                  {"$" + livePrice("weekly", emailAlerts, tier).toFixed(2)}
                </span>
                <span className="text-sm font-semibold text-[#777777]">/week</span>
              </div>
              <p className="text-xs text-[#888888] mt-2">
                Billed weekly · {tier === "premium" ? "unlimited (5 at a time)" : "3 accounts total"}
                {emailAlerts && (
                  <span className="text-[#047857] font-semibold"> · +$2.00/wk email alerts</span>
                )}
              </p>
              <div className="mt-6 flex-1">
                <CheckoutButton
                  cadence="weekly"
                  tier={tier}
                  emailAlerts={emailAlerts}
                  label="Get started"
                  variant={cadence === "weekly" ? "primary" : "secondary"}
                  fullWidth
                />
              </div>
            </Card>

            {/* Quarterly */}
            <Card
              padding="lg"
              className={`relative flex flex-col ${
                cadence === "quarterly" ? "border-2 border-[#E7F256] shadow-[0_4px_20px_rgba(231,242,86,0.35)]" : ""
              }`}
            >
              <Badge variant="lime" size="sm" className="absolute -top-3 left-6">
                <Zap className="w-3 h-3" /> Best value · 60% OFF
              </Badge>
              <h3 className="text-lg font-bold text-[#121212]">Quarterly</h3>
              <p className="text-sm text-[#555555] mt-0.5">For ongoing monitoring</p>
              <div className="mt-6 flex items-baseline gap-2 flex-wrap">
                <span className="text-lg font-bold text-[#999999] line-through decoration-[#B91C1C]/70">
                  {anchorPrice("quarterly", emailAlerts, tier)}
                </span>
                <span className="text-5xl font-extrabold tracking-tight text-[#121212]">
                  {"$" + livePrice("quarterly", emailAlerts, tier).toFixed(2)}
                </span>
                <span className="text-sm font-semibold text-[#777777]">/quarter</span>
              </div>
              <p className="text-xs text-[#888888] mt-2">
                ≈ {"$" + (livePrice("quarterly", emailAlerts, tier) / 3).toFixed(2)}/mo · Billed every 3 months
                {emailAlerts && (
                  <span className="text-[#047857] font-semibold"> · +$10.00/qtr email alerts</span>
                )}
              </p>
              <div className="mt-6 flex-1">
                <CheckoutButton
                  cadence="quarterly"
                  tier={tier}
                  emailAlerts={emailAlerts}
                  label="Get started"
                  variant={cadence === "quarterly" ? "primary" : "secondary"}
                  fullWidth
                />
              </div>
            </Card>
          </div>

          {/* Features */}
          <Card padding="lg" className="mt-10 bg-[#F9F9F7]">
            <h3 className="text-base font-extrabold text-[#121212] mb-5">
              Everything included in both plans
            </h3>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#555555]">
                  <span className="w-5 h-5 rounded-full bg-[#E7F256] border border-black/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[#121212]" strokeWidth={3} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Value props */}
          <div className="grid sm:grid-cols-3 gap-6 mt-10">
            <MiniValue icon={Clock} title="Every-other-day monitoring" body="We rescan automatically every 48 hours so you never miss a change." />
            <MiniValue icon={History} title="Accumulating history" body="Every check builds a permanent timeline you can revisit anytime." />
            <MiniValue icon={Bell} title="Change detection" body="New follows and unfollows appear in your timeline the moment they're detected." />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#F9F9F7] border-t border-[#E2E2DC]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#121212] tracking-tight text-center mb-10">
            Pricing questions
          </h2>
          <FaqList faqs={PRICING_FAQS} context="pricing" />
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-10 px-4 sm:px-6 bg-[#FFFFFF] border-t border-[#E2E2DC]">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-semibold text-[#555555]">
          <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#047857]" /> 100% Private</span>
          <span className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-[#121212]" /> No Instagram login</span>
          <span className="flex items-center gap-1.5"><Eye className="w-4 h-4 text-[#121212]" /> Target never alerted</span>
          <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#121212]" /> True chronological order</span>
        </div>
      </section>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 ${
        active ? "bg-[#121212] text-[#FFFFFF] shadow-sm" : "text-[#555555] hover:text-[#121212]"
      }`}
    >
      {label}
      {badge && (
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            active ? "bg-[#E7F256] text-[#121212]" : "bg-[#E7F256] text-[#121212]"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function MiniValue({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Clock;
  title: string;
  body: string;
}) {
  return (
    <Card hoverable className="bg-[#FFFFFF]">
      <div className="w-9 h-9 rounded-xl bg-[#EDEDE8] flex items-center justify-center mb-3 text-[#121212]">
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="font-extrabold text-sm text-[#121212] mb-1">{title}</h3>
      <p className="text-xs text-[#555555] leading-relaxed">{body}</p>
    </Card>
  );
}
