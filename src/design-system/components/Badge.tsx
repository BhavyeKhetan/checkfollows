"use client";

import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "lime" | "mono" | "emerald" | "amber" | "rose" | "muted" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
  pulse?: boolean;
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = "lime",
  size = "md",
  dot = false,
  pulse = false,
  icon,
  className = "",
  ...props
}: BadgeProps) {
  const variantStyles = {
    lime: "bg-[#E7F256] text-[#121212] border-black/10 font-bold",
    mono: "bg-[#EDEDE8] text-[#121212] border-[#E2E2DC] font-mono",
    emerald: "bg-[#E6F4EA] text-[#047857] border-[#A7F3D0]",
    amber: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
    rose: "bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]",
    muted: "bg-[#F3F3EF] text-[#555555] border-[#E2E2DC]",
    outline: "bg-transparent text-[#121212] border-[#E2E2DC]",
  };

  const dotColors = {
    lime: "bg-[#121212]",
    mono: "bg-[#121212]",
    emerald: "bg-[#047857]",
    amber: "bg-[#B45309]",
    rose: "bg-[#B91C1C]",
    muted: "bg-[#555555]",
    outline: "bg-[#121212]",
  };

  const sizeStyles = {
    sm: "text-[11px] px-2.5 py-0.5 gap-1.5 font-semibold",
    md: "text-xs px-3 py-1 gap-1.5 font-bold",
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${dotColors[variant]}`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[variant]}`}
          />
        </span>
      )}
      {icon}
      <span className="inline-flex items-center gap-1.5 leading-none">{children}</span>
    </div>
  );
}
