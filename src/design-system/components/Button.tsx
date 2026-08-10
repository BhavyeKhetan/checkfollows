"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "dark" | "secondary" | "ghost" | "outline" | "lime-subtle";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  pill?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      pill = true,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    // Ramp Yellow (#E7F256) Button Styling
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

    const pillStyles = pill ? "rounded-full" : "rounded-xl";

    const variantStyles = {
      primary:
        "bg-[#E7F256] text-[#121212] hover:bg-[#DAE64A] active:bg-[#C7D337] border border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
      dark:
        "bg-[#121212] text-[#FFFFFF] hover:bg-[#262626] active:bg-[#000000] border border-transparent shadow-sm",
      secondary:
        "bg-[#FFFFFF] text-[#121212] hover:bg-[#F8F8F5] border border-[#E2E2DC] hover:border-[#D0D0CA] shadow-sm",
      ghost:
        "bg-transparent text-[#555555] hover:text-[#121212] hover:bg-[#EFEFEA] border border-transparent",
      outline:
        "bg-transparent text-[#121212] border border-[#E2E2DC] hover:border-[#121212] hover:bg-[#FFFFFF]",
      "lime-subtle":
        "bg-[rgba(231,242,86,0.3)] text-[#121212] hover:bg-[rgba(231,242,86,0.45)] border border-[rgba(215,225,60,0.5)]",
    };

    const sizeStyles = {
      sm: "text-xs px-3.5 py-2 gap-1.5",
      md: "text-sm px-4.5 py-2.5 gap-2",
      lg: "text-base px-6 py-3.5 gap-2.5",
    };

    const widthStyle = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${pillStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
