"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Check, CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/design-system";
import { RESCAN_BUNDLES, type RescanBundle } from "@/lib/stripe";

interface SavedCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface RescanBundleModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
  onSelectBundle: (bundle: RescanBundle, changePaymentMethod?: boolean) => Promise<void>;
  loading?: boolean;
  requiredCredits?: number;
  currentBalance?: number;
}

export function RescanBundleModal({
  open,
  onClose,
  username,
  onSelectBundle,
  loading = false,
  requiredCredits,
  currentBalance,
}: RescanBundleModalProps) {
  // Default to the highest value credit pack.
  const [selectedBundle, setSelectedBundle] = useState<RescanBundle>("30");
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
    RESCAN_BUNDLES.find((b) => b.bundle === selectedBundle) || RESCAN_BUNDLES[2];

  const handle1ClickBuy = async () => {
    await onSelectBundle(selectedBundle, false);
  };

  const handleChangeCard = async () => {
    await onSelectBundle(selectedBundle, true);
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
                  Scan Credits
                </div>
                <h2 className="text-xl font-extrabold text-[#121212] tracking-tight">
                  Add scan credits
                </h2>
                <p className="text-xs text-[#555555] mt-1 font-medium">
                  Credits pay for complete following-list scans of @{username}.
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
            <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-3 text-xs text-[#166534] flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                One credit covers up to 1,000 following profiles. Purchased
                credits never expire.
              </span>
            </div>

            {typeof requiredCredits === "number" && (
              <div className="rounded-xl border border-[#E2E2DC] bg-[#FAF9F5] p-3 text-xs text-[#555555]">
                A complete scan of <strong className="text-[#121212]">@{username}</strong>{" "}
                currently uses <strong className="text-[#121212]">{requiredCredits} {requiredCredits === 1 ? "credit" : "credits"}</strong>.
                {typeof currentBalance === "number" && (
                  <> Your current balance is <strong className="text-[#121212]">{currentBalance}</strong>.</>
                )}
              </div>
            )}

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
                            {option.credits} Scan Credits
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
                          {option.unitPrice} &middot; Never expires
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
                  1-Click Buy &mdash; ${currentOption.price}
                </span>
              ) : (
                `Get ${currentOption.credits} Credits — $${currentOption.price}`
              )}
            </Button>
            <p className="text-center text-[11px] text-[#777777]">
              {card
                ? "Charges your card on file securely · Instant delivery"
                : "Secure 256-bit checkout via Stripe · 1-click delivery"}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
