"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileSpreadsheet, Check, CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/design-system";
import { EXPORT_OPTIONS, type ExportOptionTier } from "@/lib/stripe";

interface SavedCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
  onSelectOption: (tier: ExportOptionTier, changePaymentMethod?: boolean) => Promise<void>;
  loading?: boolean;
}

export function ExportModal({
  open,
  onClose,
  username,
  onSelectOption,
  loading = false,
}: ExportModalProps) {
  // Default to Unlimited Forever ($10 / $9.99 Stripe)
  const [selectedTier, setSelectedTier] = useState<ExportOptionTier>("unlimited");
  const [card, setCard] = useState<SavedCard | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/stripe/payment-method")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasCardOnFile && data.card) {
          setCard(data.card);
        } else {
          setCard(null);
        }
      })
      .catch(() => setCard(null));
  }, [open]);

  if (!open) return null;

  const currentOption =
    EXPORT_OPTIONS.find((o) => o.tier === selectedTier) || EXPORT_OPTIONS[1];

  const handle1ClickBuy = async () => {
    await onSelectOption(selectedTier, false);
  };

  const handleChangeCard = async () => {
    await onSelectOption(selectedTier, true);
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
                  <FileSpreadsheet className="w-3 h-3" />
                  Timeline Evidence Export
                </div>
                <h2 className="text-xl font-extrabold text-[#121212] tracking-tight">
                  Download History CSV
                </h2>
                <p className="text-xs text-[#555555] mt-1 font-medium">
                  Export the full timestamped log of follow/unfollow events for @{username}.
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
            {/* Options */}
            <div className="space-y-2.5">
              {EXPORT_OPTIONS.map((option) => {
                const isSelected = selectedTier === option.tier;
                return (
                  <div
                    key={option.tier}
                    onClick={() => !loading && setSelectedTier(option.tier)}
                    className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? option.tier === "unlimited"
                          ? "border-[#121212] bg-[#F9F9F7] shadow-sm ring-2 ring-[#E7F256]/70"
                          : "border-[#121212] bg-[#F9F9F7] shadow-sm"
                        : "border-[#E2E2DC] bg-white hover:border-[#CCCCCC]"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? "border-[#121212] bg-[#121212]"
                            : "border-[#CCCCCC] bg-white"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-[#E7F256]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        {option.tier === "unlimited" ? (
                          <>
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#555555]">
                              Unlimited
                            </div>
                            <div className="mt-0.5 inline-flex items-center px-2 py-[3px] rounded-md bg-[#E7F256] text-[#121212] text-xl font-black tracking-tight leading-none border border-black/10">
                              FOREVER
                            </div>
                            <div className="text-xs text-[#666666] mt-1.5">
                              {option.description}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-[#121212]">
                                {option.label}
                              </span>
                            </div>
                            <div className="text-xs text-[#666666] mt-0.5">
                              {option.description}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-black text-[#121212] leading-none ${
                          option.tier === "unlimited" ? "text-2xl" : "text-lg"
                        }`}
                      >
                        {option.tier === "unlimited" ? "$10" : `$${option.price.toFixed(2)}`}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#777777] mt-1">
                        one-time
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Saved Card on File UI */}
            {card && (
              <div className="flex items-center justify-between rounded-xl bg-[#FAF9F5] border border-[#E2E2DC] px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 font-medium text-[#121212]">
                  <CreditCard className="w-4 h-4 text-[#121212] shrink-0" />
                  <span>
                    Card on file: <strong className="capitalize">{card.brand}</strong> &bull;&bull;&bull;&bull; <strong>{card.last4}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleChangeCard}
                  disabled={loading}
                  className="text-[11px] font-bold text-[#121212] underline hover:text-[#555555] transition-colors disabled:opacity-50"
                >
                  Change card
                </button>
              </div>
            )}

            {/* Checklist */}
            <div className="rounded-xl border border-[#E2E2DC] bg-[#FAF9F5] p-3 text-[11px] text-[#555555] space-y-1.5">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                <span>Includes usernames, full names, exact event type, and timestamps</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                <span>Universal format compatible with Excel, Google Sheets & Numbers</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-3 bg-[#FAF9F5] border-t border-[#E2E2DC] flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handle1ClickBuy}
              isLoading={loading}
              className="py-3 font-extrabold text-base"
            >
              {card ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 fill-current" />
                  1-Click Buy
                </span>
              ) : currentOption.tier === "unlimited" ? (
                "Get Unlimited Forever"
              ) : (
                `Get ${currentOption.label}`
              )}
            </Button>
            <p className="text-center text-[11px] text-[#777777]">
              {card
                ? "Charges your card on file securely · Instant unlock"
                : "Secure 256-bit checkout via Stripe · Instant access"}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

