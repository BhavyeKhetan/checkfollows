"use client";

import { useState } from "react";
import { Check, Zap, Shield, Lock, Eye, Bell, History, TrendingUp, Clock } from "lucide-react";
import { Badge, Card } from "@/design-system";
import { CheckoutButton } from "@/components/marketing/checkout-button";
import { FaqList } from "@/components/marketing/faq-list";

const FEATURES = [
  "Complete chronological following list",
  "Daily monitoring with automatic rescan",
  "New-follow & unfollow change alerts",
  "Full history timeline per account",
  "Track multiple accounts",
  "No Instagram login required",
  "Cancel anytime — keep access until period end",
];

const PRICING_FAQS = [
  {
    q: "When do I get charged?",
    a: "You're charged immediately at checkout — then your plan renews every week or every 3 months depending on your cadence. You can cancel anytime, and your access continues until the end of your billing period.",
  },
  {
    q: "What happens after I subscribe?",
    a: "We immediately run a full scan of the account you searched, save it as your baseline, and start monitoring it every 24 hours automatically. You'll see new follows and unfollows as they happen.",
  },
  {
    q: "Can I track more than one account?",
    a: "Yes. Your subscription covers multiple tracked accounts, so you can monitor an ex, a crush, a competitor, or an influencer — all in one dashboard.",
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
  const [cadence, setCadence] = useState<"weekly" | "quarterly">("quarterly");
  const [emailAlerts, setEmailAlerts] = useState(false);

  return (
    <div>
      {/* Hero */}
      <section className="relative ramp-grid-bg pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 border-b border-[#E2E2DC]">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          <Badge variant="mono" size="md" className="mb-6">
            SIMPLE PRICING &middot; CANCEL ANYTIME
          </Badge>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#121212] leading-[1.08]">
            One plan. <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">Daily monitoring.</span>
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
          {/* Billing toggle */}
          <div className="flex items-center justify-center mb-10">
            <div className="inline-flex items-center rounded-full border border-[#E2E2DC] bg-[#F9F9F7] p-1">
              <ToggleBtn
                active={cadence === "weekly"}
                onClick={() => setCadence("weekly")}
                label="Weekly"
              />
              <ToggleBtn
                active={cadence === "quarterly"}
                onClick={() => setCadence("quarterly")}
                label="Quarterly"
                badge="Save 60%"
              />
            </div>
          </div>

          {/* Email alerts upsell */}
          <div className="flex items-center justify-center mb-10">
            <button
              type="button"
              onClick={() => setEmailAlerts((v) => !v)}
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
              <span className="text-sm font-extrabold text-[#047857]">
                {cadence === "weekly" ? "+$2/wk" : "+$10/qtr"}
              </span>
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 items-stretch">
            {/* Weekly */}
            <Card
              padding="lg"
              className={`flex flex-col ${
                cadence === "weekly" ? "border-2 border-[#E7F256] shadow-[0_4px_20px_rgba(231,242,86,0.35)]" : ""
              }`}
            >
              <h3 className="text-lg font-bold text-[#121212]">Weekly</h3>
              <p className="text-sm text-[#555555] mt-0.5">For short-term curiosity</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold tracking-tight text-[#121212]">
                  {emailAlerts ? "$11.99" : "$9.99"}
                </span>
                <span className="text-sm font-semibold text-[#777777]">/week</span>
              </div>
              <p className="text-xs text-[#888888] mt-2">
                Billed weekly
                {emailAlerts && (
                  <span className="text-[#047857] font-semibold"> · +$2.00/wk email alerts</span>
                )}
              </p>
              <div className="mt-6 flex-1">
                <CheckoutButton
                  cadence="weekly"
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
                <Zap className="w-3 h-3" /> Best value · Save 60%
              </Badge>
              <h3 className="text-lg font-bold text-[#121212]">Quarterly</h3>
              <p className="text-sm text-[#555555] mt-0.5">For ongoing monitoring</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold tracking-tight text-[#121212]">
                  {emailAlerts ? "$59.99" : "$49.99"}
                </span>
                <span className="text-sm font-semibold text-[#777777]">/quarter</span>
              </div>
              <p className="text-xs text-[#888888] mt-2">
                ≈ {emailAlerts ? "$20.00" : "$16.66"}/mo · Billed every 3 months
                {emailAlerts && (
                  <span className="text-[#047857] font-semibold"> · +$10.00/qtr email alerts</span>
                )}
              </p>
              <div className="mt-6 flex-1">
                <CheckoutButton
                  cadence="quarterly"
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
            <MiniValue icon={Clock} title="Daily monitoring" body="We rescan automatically every 24 hours so you never miss a change." />
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
          <FaqList faqs={PRICING_FAQS} />
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
