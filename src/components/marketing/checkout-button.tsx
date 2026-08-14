"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/design-system";

export function CheckoutButton({
  cadence,
  tier = "base",
  emailAlerts = false,
  label = "Get started",
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  cadence: "weekly" | "quarterly";
  tier?: "base" | "premium";
  emailAlerts?: boolean;
  label?: string;
  variant?: "primary" | "dark" | "secondary" | "ghost" | "outline" | "lime-subtle";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence, tier, email_alerts: emailAlerts }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Checkout couldn't be started. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className={fullWidth ? "w-full" : ""}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        isLoading={loading}
        onClick={handleCheckout}
        rightIcon={!loading ? <ArrowRight className="w-4 h-4" /> : undefined}
        className={className}
      >
        {label}
      </Button>
      {error && (
        <p className="mt-2 text-xs font-semibold text-[#B91C1C] text-center">{error}</p>
      )}
    </div>
  );
}
