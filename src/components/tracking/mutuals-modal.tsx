"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Search, Check, CreditCard, Sparkles, Lock } from "lucide-react";
import { Button } from "@/design-system";

interface SavedCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface MutualsModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
  otherUsername: string;
  hasCredit: boolean;
  onPurchase: (changePaymentMethod?: boolean) => Promise<boolean>;
  onRunReport: () => Promise<string | null>;
  loading?: boolean;
}

const SCAN_MS = 6500;
const MIN_CREDIT_SCAN_MS = 2200;
const TICK_MS = 90;

const SCAN_MESSAGES = [
  "Connecting to Instagram…",
  "Reading @{a}'s following list…",
  "Scanning @{b}…",
  "Matching overlapping accounts…",
  "Building your mutuals report…",
];

const TEASER_HANDLES = [
  "maya.r",
  "jake_m",
  "sofia.k",
  "n.alex",
  "cam.w",
  "elena.b",
  "ryan_j",
  "isa.m",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function MutualsModal({
  open,
  onClose,
  username,
  otherUsername,
  hasCredit,
  onPurchase,
  onRunReport,
  loading = false,
}: MutualsModalProps) {
  const [phase, setPhase] = useState<"scanning" | "paywall" | "error">("scanning");
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [card, setCard] = useState<SavedCard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setPhase("scanning");
      setProgress(0);
      setMsgIdx(0);
      setError("");
      setCard(null);
      return;
    }

    let cancelled = false;
    let elapsed = 0;
    setPhase("scanning");
    setProgress(0);
    setMsgIdx(0);
    setError("");

    const interval = setInterval(() => {
      elapsed += TICK_MS;
      if (hasCredit) {
        setProgress(Math.min(92, Math.round((elapsed / 8000) * 92)));
        setMsgIdx(
          Math.min(
            SCAN_MESSAGES.length - 1,
            Math.floor((elapsed / 8000) * SCAN_MESSAGES.length)
          )
        );
        return;
      }
      setProgress(Math.min(100, Math.round((elapsed / SCAN_MS) * 100)));
      setMsgIdx(
        Math.min(
          SCAN_MESSAGES.length - 1,
          Math.floor((elapsed / SCAN_MS) * SCAN_MESSAGES.length)
        )
      );
      if (elapsed >= SCAN_MS) {
        clearInterval(interval);
        if (!cancelled) {
          setProgress(100);
          setPhase("paywall");
        }
      }
    }, TICK_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, hasCredit, otherUsername]);

  useEffect(() => {
    if (!open || !hasCredit) return;
    let cancelled = false;
    const started = Date.now();

    void (async () => {
      const err = await onRunReport();
      const wait = MIN_CREDIT_SCAN_MS - (Date.now() - started);
      if (wait > 0) await sleep(wait);
      if (cancelled) return;
      if (err) {
        setError(err);
        setPhase("error");
        return;
      }
      onClose();
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally tied to the open session, not callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasCredit, otherUsername]);

  useEffect(() => {
    if (!open || hasCredit) return;
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
  }, [open, hasCredit]);

  if (!open) return null;

  const message = SCAN_MESSAGES[msgIdx]
    .replace("@{a}", `@${username}`)
    .replace("@{b}", `@${otherUsername}`);

  const handleUnlock = async () => {
    const charged = await onPurchase(false);
    if (!charged) return;
    setPhase("scanning");
    setProgress(8);
    setMsgIdx(0);
    let elapsed = 0;
    const pulse = setInterval(() => {
      elapsed += 400;
      setProgress(Math.min(92, 8 + Math.round((elapsed / 12000) * 84)));
      setMsgIdx(
        Math.min(
          SCAN_MESSAGES.length - 1,
          Math.floor((elapsed / 12000) * SCAN_MESSAGES.length)
        )
      );
    }, 400);
    const err = await onRunReport();
    clearInterval(pulse);
    if (err) {
      setError(err);
      setPhase("error");
      return;
    }
    setProgress(100);
    onClose();
  };

  const handleChangeCard = async () => {
    await onPurchase(true);
  };

  const busy = loading || phase === "scanning";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={busy ? undefined : onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-[#FFFFFF] rounded-2xl border border-[#E2E2DC] shadow-2xl overflow-hidden z-10"
        >
          <div className="p-6 pb-4 border-b border-[#E2E2DC] bg-[#FAF9F5]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#121212] text-[#E7F256] text-[11px] font-extrabold uppercase tracking-wide mb-2">
                  <Users className="w-3 h-3" />
                  Mutual follows
                </div>
                <h2 className="text-xl font-extrabold text-[#121212] tracking-tight">
                  @{username} × @{otherUsername}
                </h2>
                <p className="text-xs text-[#555555] mt-1 font-medium">
                  Who they both follow.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg p-1.5 text-[#777777] hover:text-[#121212] hover:bg-black/5 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {phase === "scanning" && (
            <div className="px-6 py-10 flex flex-col items-center text-center">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-[#EDEDE8]" />
                <div className="absolute inset-0 rounded-full border-2 border-[#E7F256] border-t-[#121212] animate-spin" />
                <div className="absolute inset-5 rounded-full border border-[#E2E2DC]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="w-7 h-7 text-[#121212]" />
                </div>
              </div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#E7F256] text-[#121212] text-[11px] font-extrabold uppercase tracking-wide mb-3">
                <span className="w-2 h-2 rounded-full bg-[#121212] animate-ping mr-1.5 inline-block" />
                Scanning in progress
              </div>
              <p className="text-sm font-semibold text-[#555555] min-h-[40px] px-2">
                {message}
              </p>
              <div className="w-full max-w-xs mt-6">
                <div className="w-full h-2.5 bg-[#EDEDE8] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#E7F256] border-r-2 border-[#121212]"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <p className="text-xs font-mono font-bold text-[#555555] mt-2">
                  {progress}%
                </p>
              </div>
            </div>
          )}

          {phase === "paywall" && (
            <div className="p-6 space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E7F256] text-[#121212] text-[11px] font-extrabold uppercase tracking-wide mb-1">
                  Your report is ready
                </div>
                <h3 className="text-lg font-extrabold text-[#121212] tracking-tight">
                  We found overlapping follows
                </h3>
                <p className="text-xs text-[#555555] font-medium">
                  Unlock the names they both follow.
                </p>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-[#E2E2DC] bg-[#F9F9F7] min-h-[132px]">
                <div
                  className="p-3 flex flex-wrap gap-2 blur-[6px] opacity-80 pointer-events-none select-none"
                  aria-hidden="true"
                >
                  {TEASER_HANDLES.map((handle) => (
                    <span
                      key={handle}
                      className="inline-flex items-center rounded-full border border-[#E2E2DC] bg-white px-3 py-1 text-xs font-bold text-[#121212]"
                    >
                      @{handle}
                    </span>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#121212] text-[#E7F256] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide">
                    <Lock className="w-3 h-3" />
                    Hidden until unlock
                  </div>
                </div>
              </div>

              <div className="rounded-xl border-2 border-[#121212] bg-[#F9F9F7] p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#121212]">
                    Mutuals report
                  </div>
                  <div className="text-xs text-[#666666] mt-0.5">
                    One comparison · @{username} and @{otherUsername}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-black text-[#121212] leading-none">
                    $4.99
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#777777] mt-1">
                    one-time
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#E2E2DC] bg-[#FAF9F5] p-3 text-[11px] text-[#555555] space-y-1.5">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                  <span>Handles, names, and verification for every overlap</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                  <span>Uses @{otherUsername}&apos;s current following list</span>
                </div>
              </div>

              {card && (
                <div className="flex items-center justify-between rounded-xl bg-[#FAF9F5] border border-[#E2E2DC] px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2 font-medium text-[#121212]">
                    <CreditCard className="w-4 h-4 text-[#121212] shrink-0" />
                    <span>
                      Card on file:{" "}
                      <strong className="capitalize">{card.brand}</strong>{" "}
                      &bull;&bull;&bull;&bull; <strong>{card.last4}</strong>
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

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleUnlock}
                isLoading={loading}
                className="py-3 font-extrabold text-base"
              >
                {card ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 fill-current" />
                    Unlock the report
                  </span>
                ) : (
                  "Unlock the report"
                )}
              </Button>
              <p className="text-center text-[11px] text-[#777777]">
                {card
                  ? "Charges your card on file securely · Instant unlock"
                  : "Secure 256-bit checkout via Stripe · Instant access"}
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="p-6 space-y-4 text-center">
              <p className="text-sm font-semibold text-[#B91C1C]">{error}</p>
              <Button variant="secondary" fullWidth onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
