"use client";

import React from "react";

export interface AvatarProps {
  src?: string | null;
  username: string;
  size?: "sm" | "md" | "lg" | "xl";
  isVerified?: boolean;
  limeHalo?: boolean;
  className?: string;
}

export function Avatar({
  src,
  username,
  size = "md",
  isVerified = false,
  limeHalo = false,
  className = "",
}: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-xl",
  };

  const initial = username ? username[0].toUpperCase() : "?";

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div
        className={`${sizes[size]} rounded-full flex items-center justify-center font-extrabold overflow-hidden transition-all ${
          limeHalo
            ? "ring-3 ring-[#E7F256] ring-offset-2 ring-offset-[#FFFFFF]"
            : "border border-[#E2E2DC]"
        } bg-[#EDEDE8] text-[#121212]`}
      >
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={username}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {isVerified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 bg-[#FFFFFF] rounded-full p-0.5 text-[#0EA5E9] shadow-sm border border-[#E2E2DC]"
          title="Verified"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </span>
      )}
    </div>
  );
}
