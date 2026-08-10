"use client";

import React from "react";
import { motion } from "framer-motion";

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  fullWidth?: boolean;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = "",
  fullWidth = false,
}: TabsProps<T>) {
  return (
    <div
      className={`inline-flex items-center p-1 rounded-full bg-[#EFEFEA] border border-[#E2E2DC] ${
        fullWidth ? "w-full" : ""
      } ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-colors ${
              fullWidth ? "flex-1" : ""
            } ${isActive ? "text-[#121212]" : "text-[#555555] hover:text-[#121212]"}`}
          >
            {isActive && (
              <motion.div
                layoutId="ramp-active-tab-indicator"
                className="absolute inset-0 bg-[#FFFFFF] rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.08)] border border-[#E2E2DC]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? "bg-[#E7F256] text-[#121212]"
                      : "bg-[#E2E2DC] text-[#555555]"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
