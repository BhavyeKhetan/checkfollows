"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { Badge, Button } from "@/design-system";
import { AppShell } from "@/components/app/app-shell";
import {
  SubscriptionPlanPicker,
  type SubscriptionCadence as Cadence,
  type SubscriptionTier as Tier,
} from "@/components/subscription/subscription-plan-picker";
import { track } from "@/lib/mixpanel";

export default function AppPricingClient() {
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [tier, setTier] = useState<Tier>("base");
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    track("paywall_viewed", { source: "app" });
  }, []);

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
        window.location.assign("/dashboard");
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
    <AppShell>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-xl text-center">
          <Badge variant="lime" className="mb-4">UNLOCK YOUR ACCOUNT</Badge>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            See every change. Keep the full history.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm font-medium text-[#555555] sm:text-base">
            Choose your plan to reveal tracked accounts, follow changes, exports, and automatic monitoring.
          </p>
        </div>

        <SubscriptionPlanPicker
          cadence={cadence}
          tier={tier}
          emailAlerts={emailAlerts}
          onTierChange={(value) => {
            setTier(value);
            track("plan_tier_selected", { tier: value, source: "app" });
          }}
          onCadenceChange={(value) => {
            setCadence(value);
            track("billing_cadence_selected", { cadence: value, source: "app" });
          }}
          onEmailAlertsChange={(value) => {
            setEmailAlerts(value);
            track("email_alerts_toggled", {
              state: value ? "on" : "off",
              cadence,
              source: "app",
            });
          }}
        >
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
        </SubscriptionPlanPicker>
      </main>
    </AppShell>
  );
}
