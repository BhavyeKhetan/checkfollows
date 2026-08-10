"use client";

import React from "react";
import { Badge } from "./Badge";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  highlighted?: boolean;
}

export function StatCard({
  label,
  value,
  subtext,
  change,
  changeType = "positive",
  icon,
  highlighted = false,
}: StatCardProps) {
  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        highlighted
          ? "bg-[#FFFFFF] border-2 border-[#E7F256] shadow-[0_4px_16px_rgba(231,242,86,0.3)]"
          : "bg-[#FFFFFF] border-[#E2E2DC] hover:border-[#D0D0CA] shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#555555]">
          {label}
        </span>
        {icon && <div className="p-2 rounded-xl bg-[#F9F9F7] border border-[#E2E2DC] text-[#121212]">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212]">
          {value}
        </span>
        {change && (
          <Badge
            variant={
              changeType === "positive"
                ? "lime"
                : changeType === "negative"
                ? "rose"
                : "muted"
            }
            size="sm"
          >
            {change}
          </Badge>
        )}
      </div>

      {subtext && <p className="mt-1 text-xs text-[#777777]">{subtext}</p>}
    </div>
  );
}
