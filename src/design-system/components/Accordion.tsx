"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function AccordionItem({
  title,
  children,
  isOpen = false,
  onToggle,
}: AccordionItemProps) {
  return (
    <div className="border-b border-[#E2E2DC] last:border-b-0 py-1">
      <button
        onClick={onToggle}
        className="w-full py-4 flex items-center justify-between gap-4 text-left font-semibold text-[#121212] hover:text-[#555555] transition-colors"
      >
        <span className="text-base font-bold">{title}</span>
        <ChevronDown
          className={`w-5 h-5 text-[#777777] shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#121212]" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-sm text-[#555555] leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
