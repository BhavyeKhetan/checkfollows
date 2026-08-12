"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/design-system";

export function CheckoutButton({
  cadence,
  label = "Start free trial",
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  cadence: "weekly" | "quarterly";
  label?: string;
  variant?: "primary" | "dark" | "secondary" | "ghost" | "outline" | "lime-subtle";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  return (
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
  );
}
