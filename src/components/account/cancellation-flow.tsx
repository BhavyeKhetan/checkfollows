"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Gift,
  X,
} from "lucide-react";
import { Badge, Button } from "@/design-system";
import { track } from "@/lib/mixpanel";

const REASONS = [
  ["too_expensive", "It costs too much"],
  ["not_using_enough", "I’m not using it enough"],
  ["missing_features", "It’s missing something I need"],
  ["technical_issues", "I had technical issues"],
  ["tracking_someone_else", "I no longer need to track this account"],
  ["privacy_concerns", "I have privacy concerns"],
  ["other", "Something else"],
] as const;

export function CancellationFlow({
  open,
  currentPeriodEnd,
  discountUsed,
  pauseUsed,
  onClose,
  onChanged,
  onOpenPlan,
}: {
  open: boolean;
  currentPeriodEnd: string | null;
  discountUsed: boolean;
  pauseUsed: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
  onOpenPlan: () => void;
}) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    track("cancellation_flow_started");
  }, [open]);

  if (!open) return null;

  const closeFlow = () => {
    setStep(1);
    setReason("");
    setNote("");
    setLoading("");
    setError("");
    onClose();
  };

  const action = async (value: "pause_month" | "apply_discount" | "cancel") => {
    setLoading(value);
    setError("");
    try {
      const response = await fetch("/api/stripe/subscription/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: value, reason, note }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error || "That change could not be completed.");
        setLoading("");
        return;
      }
      if (value === "pause_month") {
        track("cancellation_pause_accepted");
        onChanged("Your billing is paused for 30 days. Your monitoring remains active.");
      } else if (value === "apply_discount") {
        track("cancellation_discount_accepted", { percent_off: 50 });
        onChanged("50% off has been applied to your next billing cycle.");
      } else {
        track("subscription_cancel_scheduled", { reason });
        onChanged(
          currentPeriodEnd
            ? `Cancellation scheduled. Your access continues until ${formatDate(currentPeriodEnd)}.`
            : "Cancellation scheduled. You will not be charged again."
        );
      }
      closeFlow();
    } catch {
      setError("Network error. Please try again.");
      setLoading("");
    }
  };

  const continueButton = (next: number, label = "Continue cancellation") => (
    <button
      type="button"
      onClick={() => setStep(next)}
      className="mt-3 w-full py-3 text-sm font-bold text-[#555555] underline decoration-[#9A9A94] underline-offset-4"
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cancel subscription"
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 border-b border-[#E2E2DC] bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold tracking-wide text-[#74746E]">
                STEP {step} OF 5
              </div>
              <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-[#EDEDE8]">
                <div
                  className="h-full rounded-full bg-[#121212] transition-all"
                  style={{ width: `${step * 20}%` }}
                />
              </div>
            </div>
            <button
              type="button"
                onClick={closeFlow}
              className="rounded-full p-2 text-[#555555] hover:bg-[#F2F2ED]"
              aria-label="Close cancellation flow"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {step === 1 && (
            <div>
              <Badge variant="mono" className="mb-3">BEFORE YOU GO</Badge>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Your history stops building when access ends
              </h2>
              <p className="mt-2 text-sm font-medium text-[#555555]">
                You keep access through the paid period, then tracked profiles, timelines, alerts, rescans, and exports lock again.
              </p>
              <div className="mt-5 space-y-2 rounded-2xl bg-[#F5F5F0] p-4 text-sm font-bold">
                <p>• Automatic monitoring stops</p>
                <p>• New follow and unfollow events stop accumulating</p>
                <p>• Existing tracking history becomes hidden</p>
              </div>
              <Button variant="primary" size="lg" className="mt-6 w-full" onClick={closeFlow}>
                Keep my subscription
              </Button>
              {continueButton(2)}
            </div>
          )}

          {step === 2 && (
            <div>
              <button type="button" onClick={() => setStep(1)} className="mb-4 flex items-center gap-1 text-xs font-bold text-[#555555]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 className="text-2xl font-extrabold">What’s making you leave?</h2>
              <p className="mt-1 text-sm text-[#555555]">Choose the closest reason and tell us anything we should know.</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {REASONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setReason(value);
                      track("cancellation_reason_selected", { reason: value });
                    }}
                    className={`rounded-xl border p-3 text-left text-sm font-bold ${
                      reason === value
                        ? "border-[#121212] bg-[#F2F4B8]"
                        : "border-[#E2E2DC] bg-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 500))}
                placeholder="What could we have done better? (optional)"
                rows={4}
                className="mt-4 w-full resize-none rounded-xl border border-[#DADAD3] p-3 text-sm outline-none focus:border-[#121212]"
              />
              <Button
                variant="primary"
                size="lg"
                className="mt-4 w-full"
                disabled={!reason}
                onClick={() => setStep(3)}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Review my options
              </Button>
            </div>
          )}

          {step === 3 && (
            <div>
              <button type="button" onClick={() => setStep(2)} className="mb-4 flex items-center gap-1 text-xs font-bold text-[#555555]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 className="text-2xl font-extrabold">A smaller plan may fit better</h2>
              <p className="mt-1 text-sm text-[#555555]">
                Change tier, billing schedule, or remove email alerts without losing your tracking history.
              </p>
              <button
                type="button"
                onClick={() => {
                  track("cancellation_plan_change_opened");
                  onOpenPlan();
                  closeFlow();
                }}
                className="mt-5 flex w-full items-center gap-4 rounded-2xl border-2 border-[#121212] bg-[#FBFDDC] p-4 text-left"
              >
                <CreditCard className="h-6 w-6 shrink-0" />
                <span className="flex-1">
                  <span className="block font-extrabold">Change or downgrade my plan</span>
                  <span className="block text-xs font-medium text-[#555555]">See Basic, Premium, weekly, and quarterly options</span>
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <Button variant="secondary" size="lg" className="mt-4 w-full" onClick={closeFlow}>
                Keep my current plan
              </Button>
              {continueButton(4)}
            </div>
          )}

          {step === 4 && (
            <div>
              <button type="button" onClick={() => setStep(3)} className="mb-4 flex items-center gap-1 text-xs font-bold text-[#555555]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 className="text-2xl font-extrabold">Take a billing break</h2>
              <p className="mt-1 text-sm text-[#555555]">
                Keep monitoring and access, but pay nothing for the next 30 days. Billing resumes automatically after the break.
              </p>
              <div className="mt-5 rounded-2xl border border-[#C9D4FF] bg-[#EEF2FF] p-5">
                <CalendarClock className="h-7 w-7" />
                <p className="mt-3 font-extrabold">30 days with no charges</p>
                <p className="mt-1 text-xs font-medium text-[#555555]">One-time retention offer. Your product access stays active.</p>
              </div>
              {!pauseUsed ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-5 w-full"
                  isLoading={loading === "pause_month"}
                  onClick={() => action("pause_month")}
                >
                  Pause billing for 30 days
                </Button>
              ) : (
                <p className="mt-4 rounded-xl bg-[#F5F5F0] p-3 text-sm font-bold text-[#555555]">This one-time billing break has already been used.</p>
              )}
              {continueButton(5, "No thanks, continue cancellation")}
            </div>
          )}

          {step === 5 && (
            <div>
              <button type="button" onClick={() => setStep(4)} className="mb-4 flex items-center gap-1 text-xs font-bold text-[#555555]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 className="text-2xl font-extrabold">One final option: 50% off</h2>
              <p className="mt-1 text-sm text-[#555555]">
                Stay and get 50% off your next billing cycle. Your normal price resumes after that one cycle.
              </p>
              <div className="mt-5 rounded-2xl border-2 border-[#E7F256] bg-[#FBFDDC] p-5 text-center">
                <Gift className="mx-auto h-8 w-8" />
                <div className="mt-2 text-3xl font-extrabold">50% OFF</div>
                <div className="text-xs font-bold text-[#555555]">YOUR NEXT BILLING CYCLE</div>
              </div>
              {!discountUsed ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-5 w-full"
                  isLoading={loading === "apply_discount"}
                  onClick={() => action("apply_discount")}
                >
                  Apply 50% discount and stay
                </Button>
              ) : (
                <p className="mt-4 rounded-xl bg-[#F5F5F0] p-3 text-sm font-bold text-[#555555]">This one-time discount has already been used.</p>
              )}

              <div className="mt-6 border-t border-[#E2E2DC] pt-5">
                <p className="text-center text-sm font-bold">
                  {currentPeriodEnd
                    ? `Cancel now and keep access until ${formatDate(currentPeriodEnd)}`
                    : "Cancel now and stop future renewals"}
                </p>
                {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                <Button variant="secondary" size="lg" className="mt-4 w-full" onClick={closeFlow}>
                  Keep my subscription
                </Button>
                <button
                  type="button"
                  disabled={loading === "cancel"}
                  onClick={() => action("cancel")}
                  className="mt-3 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                >
                  {loading === "cancel" ? "Scheduling cancellation…" : "Cancel my subscription"}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-[#6B6B66]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> No additional charges after your paid period.
                </p>
              </div>
            </div>
          )}

          {step < 5 && (
            <button
              type="button"
              onClick={() => {
                if (!reason) setReason("other");
                track("cancellation_offers_skipped", { from_step: step });
                setStep(5);
              }}
              className="mt-5 w-full text-center text-xs font-bold text-[#777771] underline underline-offset-4"
            >
              Skip offers and go to final cancellation
            </button>
          )}

          {error && step < 5 && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
