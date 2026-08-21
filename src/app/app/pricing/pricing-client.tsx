"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, Check, Lock, Sparkles } from "lucide-react";
import { Badge, Button, Card, Logo } from "@/design-system";
import { track } from "@/lib/mixpanel";

type Cadence = "weekly" | "quarterly";
type Tier = "base" | "premium";

export default function AppPricingClient() {
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [tier, setTier] = useState<Tier>("base");
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    track("paywall_viewed", { source: "app" });
  }, []);

  const price = useMemo(() => {
    const base =
      tier === "premium"
        ? cadence === "weekly" ? 12.99 : 64.99
        : cadence === "weekly" ? 9.99 : 49.99;
    return base + (emailAlerts ? (cadence === "weekly" ? 2 : 10) : 0);
  }, [cadence, tier, emailAlerts]);

  const beginCheckout = async () => {
    setLoading(true);
    setError("");
    track("checkout_started", {
      source: "app_paywall",
      cadence,
      tier,
      email_alerts: emailAlerts,
    });
    try {
      const response = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence, tier, email_alerts: emailAlerts }),
      });
      const json = await response.json().catch(() => ({}));
      if (response.status === 409) {
        window.location.assign("/account");
        return;
      }
      if (!response.ok || !json.url) {
        setError(json.error || "Checkout could not be started.");
        setLoading(false);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F4] text-[#121212]">
      <nav className="sticky top-0 z-40 border-b border-[#E2E2DC] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo href="/account" size="sm" />
          <Badge variant="mono" size="sm">SECURE CHECKOUT</Badge>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-xl text-center">
          <Badge variant="lime" className="mb-4">UNLOCK YOUR ACCOUNT</Badge>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            See every change. Keep the full history.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm font-medium text-[#555555] sm:text-base">
            Choose your plan to reveal tracked accounts, follow changes, exports, and automatic monitoring.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {([
            ["base", "Basic", "Track up to 3 accounts total"],
            ["premium", "Premium", "Unlimited accounts, 5 monitored at once"],
          ] as const).map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTier(value);
                track("plan_tier_selected", { tier: value, source: "app" });
              }}
              className={`rounded-2xl border-2 p-5 text-left transition ${
                tier === value
                  ? "border-[#121212] bg-white shadow-sm"
                  : "border-[#E2E2DC] bg-white/65"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold">{label}</span>
                {tier === value && <Check className="h-5 w-5" />}
              </div>
              <p className="mt-1 text-xs font-medium text-[#555555]">{description}</p>
            </button>
          ))}
        </div>

        <Card variant="highlight" padding="lg" className="mt-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-lg font-extrabold">Your subscription</h2>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white p-1.5">
                {(["weekly", "quarterly"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setCadence(value);
                      track("billing_cadence_selected", { cadence: value, source: "app" });
                    }}
                    className={`rounded-lg px-3 py-2.5 text-sm font-bold capitalize ${
                      cadence === value ? "bg-[#121212] text-white" : "text-[#555555]"
                    }`}
                  >
                    {value === "quarterly" ? "Every 3 months" : "Weekly"}
                  </button>
                ))}
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#DADAD3] bg-white p-4">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(event) => {
                    setEmailAlerts(event.target.checked);
                    track("email_alerts_toggled", {
                      state: event.target.checked ? "on" : "off",
                      cadence,
                      source: "app",
                    });
                  }}
                  className="mt-0.5 h-4 w-4 accent-[#121212]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-extrabold">
                    <Bell className="h-4 w-4" /> Email change alerts
                  </span>
                  <span className="mt-0.5 block text-xs text-[#555555]">
                    Get notified when new follow and unfollow events are detected.
                  </span>
                </span>
              </label>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-3xl font-extrabold">${price.toFixed(2)}</div>
              <div className="text-xs font-bold text-[#555555]">
                {cadence === "weekly" ? "per week" : "every 3 months"}
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            className="mt-5 w-full"
            isLoading={loading}
            onClick={beginCheckout}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Continue to secure checkout
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-[#6B6B66]">
            <Lock className="h-3.5 w-3.5" /> Cancel anytime from your account. Payments handled by Stripe.
          </p>
        </Card>
      </main>
    </div>
  );
}
