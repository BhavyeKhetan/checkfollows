"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Check } from "lucide-react";
import { Button } from "@/design-system";
import { RESCAN_BUNDLES, type RescanBundle } from "@/lib/stripe";

interface RescanBundleModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
  onSelectBundle: (bundle: RescanBundle) => Promise<void>;
  loading?: boolean;
}

export function RescanBundleModal({
  open,
  onClose,
  username,
  onSelectBundle,
  loading = false,
}: RescanBundleModalProps) {
  // Default to the highest value $20 bundle (30 rescans) as requested
  const [selectedBundle, setSelectedBundle] = useState<RescanBundle>("30");

  if (!open) return null;

  const currentOption =
    RESCAN_BUNDLES.find((b) => b.bundle === selectedBundle) || RESCAN_BUNDLES[2];

  const handleCheckout = async () => {
    await onSelectBundle(selectedBundle);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={loading ? undefined : onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-[#FFFFFF] rounded-2xl border border-[#E2E2DC] shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-[#E2E2DC] bg-[#FAF9F5]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#121212] text-[#E7F256] text-[11px] font-extrabold uppercase tracking-wide mb-2">
                  <Zap className="w-3 h-3" />
                  On-Demand Rescans
                </div>
                <h2 className="text-xl font-extrabold text-[#121212] tracking-tight">
                  Instant Rescan Pack
                </h2>
                <p className="text-xs text-[#555555] mt-1 font-medium">
                  Skip the 48h monitoring queue and scan @{username} immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg p-1.5 text-[#777777] hover:text-[#121212] hover:bg-black/5 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Free scan banner info */}
            <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-3 text-xs text-[#166534] flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                <strong>1 free rescan</strong> is included with your plan. Need more? Choose a pack below.
              </span>
            </div>

            {/* Bundle Options */}
            <div className="space-y-2.5">
              {RESCAN_BUNDLES.map((option) => {
                const isSelected = selectedBundle === option.bundle;
                return (
                  <div
                    key={option.bundle}
                    onClick={() => !loading && setSelectedBundle(option.bundle)}
                    className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-[#121212] bg-[#F9F9F7] shadow-sm"
                        : "border-[#E2E2DC] bg-white hover:border-[#CCCCCC]"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "border-[#121212] bg-[#121212]"
                            : "border-[#CCCCCC] bg-white"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-[#E7F256]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-[#121212]">
                            {option.credits} Rescans
                          </span>
                          {option.badge && (
                            <span className="px-2 py-0.5 rounded-full bg-[#E7F256] text-[#121212] text-[10px] font-extrabold border border-black/10">
                              {option.badge}
                            </span>
                          )}
                          {option.label && !option.badge && (
                            <span className="text-[11px] font-bold text-[#777777]">
                              ({option.label})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#666666] mt-0.5">
                          {option.unitPrice} per scan &middot; Never expires
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-[#121212]">
                        ${option.price}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#777777]">
                        one-time
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Value Callout */}
            <div className="rounded-xl border border-[#E2E2DC] bg-[#FAF9F5] p-3 text-[11px] text-[#666666] flex items-center justify-between">
              <span>⚡ Full account scan (100% of followings)</span>
              <span className="font-semibold text-[#121212]">Instant delivery</span>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-3 bg-[#FAF9F5] border-t border-[#E2E2DC] flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleCheckout}
              isLoading={loading}
              className="py-3 font-extrabold text-base"
            >
              Get {currentOption.credits} Rescans &mdash; ${currentOption.price}
            </Button>
            <p className="text-center text-[11px] text-[#777777]">
              Secure 256-bit checkout via Stripe &middot; 1-click delivery to your account
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
