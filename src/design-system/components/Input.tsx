"use client";

import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightElement, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-[#555555] uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-[#555555] pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-[#FFFFFF] border border-[#E2E2DC] text-[#121212] placeholder:text-[#888888] text-base sm:text-sm rounded-xl py-3 px-4 transition-all duration-200 focus:outline-none focus:border-[#121212] focus:ring-2 focus:ring-[rgba(18,18,18,0.08)] ${
              leftIcon ? "pl-10" : ""
            } ${rightElement ? "pr-12" : ""} ${
              error ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[rgba(239,68,68,0.15)]" : ""
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center">{rightElement}</div>
          )}
        </div>
        {error && <p className="text-xs text-[#B91C1C] mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
