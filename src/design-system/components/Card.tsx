"use client";

import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "highlight" | "glass" | "subtle";
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  children,
  variant = "default",
  hoverable = false,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  const variantStyles = {
    default:
      "bg-[#FFFFFF] border-[#E2E2DC] shadow-[0_2px_12px_rgba(0,0,0,0.03)]",
    highlight:
      "bg-[#FFFFFF] border-2 border-[#E7F256] shadow-[0_4px_20px_rgba(231,242,86,0.35)]",
    glass:
      "bg-[rgba(255,255,255,0.85)] backdrop-blur-xl border-[#E2E2DC]",
    subtle:
      "bg-[#F9F9F7] border-[#E2E2DC]",
  };

  const paddingStyles = {
    none: "p-0",
    sm: "p-3 sm:p-4",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
  };

  const hoverStyles = hoverable
    ? "transition-all duration-200 hover:border-[#D0D0CA] hover:bg-[#FBFBF9] hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] hover:translate-y-[-1px]"
    : "";

  return (
    <div
      className={`rounded-2xl border ${variantStyles[variant]} ${paddingStyles[padding]} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[#E2E2DC] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-lg font-bold text-[#121212] tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm text-[#555555] ${className}`} {...props}>
      {children}
    </p>
  );
}
