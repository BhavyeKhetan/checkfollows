"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Lock,
  Check,
  Shield,
  Bell,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Eye,
  History,
  Clock,
  Search,
} from "lucide-react";
import { Button, Input, Card, Badge, Logo } from "@/design-system";
import EmbeddedCheckout from "@/components/checkout/embedded-checkout";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/mixpanel";

type Step = "email" | "relationship" | "scanning" | "paywall";
type Cadence = "weekly" | "quarterly";
type Tier = "base" | "premium";

const RELATIONSHIP_OPTIONS = [
  { value: "friend", label: "A friend", emoji: "👋" },
  { value: "ex", label: "An ex", emoji: "💔" },
  { value: "colleague", label: "A colleague", emoji: "💼" },
  { value: "random", label: "A random person online", emoji: "🌐" },
  { value: "prefer_not_to_say", label: "Prefer not to say", emoji: "🤐" },
];

const FEATURES = [
  "Complete chronological following list",
  "Every-other-day monitoring with automatic rescan",
  "New-follow & unfollow change alerts",
  "Full history timeline per account",
  "No Instagram login required",
  "Cancel anytime — keep access until period end",
];

const PAYWALL_FAQS = [
  {
    q: "How does it work?",
    a: "We scan the account you searched and save it as a baseline, then automatically rescan every 48 hours to detect new follows and unfollows.",
  },
  {
    q: "Will they know I checked?",
    a: "No. CheckFollows never interacts with Instagram on your behalf. The person is never alerted in any way.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, 1-click cancellation. Your access and monitoring continue until the end of your billing period.",
  },
];

const BASE_PRICES: Record<Cadence, number> = { weekly: 9.99, quarterly: 49.99 };
const PREMIUM_PRICES: Record<Cadence, number> = { weekly: 12.99, quarterly: 64.99 };
const ALERTS_ADDON: Record<Cadence, number> = { weekly: 2, quarterly: 10 };
const PERIOD: Record<Cadence, string> = { weekly: "/week", quarterly: "/week" };

// Weekly equivalent calculation (1 quarter = 13 weeks)
function weeklyRate(amount: number, cadence: Cadence): number {
  return cadence === "quarterly" ? amount / 13 : amount;
}

// Alerts weekly add-on cost
function alertsWeeklyRate(cadence: Cadence): number {
  return cadence === "quarterly" ? ALERTS_ADDON.quarterly / 13 : ALERTS_ADDON.weekly;
}

// Anchor comparison: For quarterly, compare directly against paying weekly ($12.99/wk or $9.99/wk)
function anchorPrice(cadence: Cadence, emailAlerts: boolean, tier: Tier): string {
  if (cadence === "quarterly") {
    const weeklyPrice = tier === "premium" ? (emailAlerts ? 14.99 : 12.99) : (emailAlerts ? 11.99 : 9.99);
    return `$${weeklyPrice.toFixed(2)}`;
  }
  if (tier === "premium") {
    return emailAlerts ? "$37.49" : "$32.49";
  }
  return emailAlerts ? "$29.99" : "$24.99";
}

const SCAN_MESSAGES = [
  "Connecting to Instagram…",
  "Fetching @{u} recent follows…",
  "Scanning follower list…",
  "Analyzing activity order…",
  "Building your report…",
];

function isValidEmail(val: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = (searchParams.get("username") || "").replace(/^@/, "");
  const targetId = searchParams.get("targetId") || "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [cadence, setCadence] = useState<Cadence>("quarterly");
  const [tier, setTier] = useState<Tier>("premium");
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [finalizing, setFinalizing] = useState(
    searchParams.get("finalize") === "1"
  );
  const [finalizePhase, setFinalizePhase] = useState<"confirming" | "success">(
    "confirming"
  );

  // One-time funnel entry + paywall view signals.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      track("onboarding_started", {
        username: username || undefined,
        has_username: !!username,
      });
    }
  }, [username]);

  useEffect(() => {
    if (step === "paywall") {
      track("paywall_viewed", { username: username || undefined });
    }
  }, [step, username]);

  // After payment: signed-in users go straight to their account; everyone
  // else completes a quick signup so we can tie the subscription to them.
  const redirectAfterPayment = async (params: URLSearchParams) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        track("post_purchase_redirect", { destination: "dashboard" });
        router.replace("/dashboard");
        return;
      }
    } catch {
      /* ignore */
    }
    track("post_purchase_redirect", { destination: "signup" });
    router.replace(`/signup?${params.toString()}`);
  };

  // ── Post-payment (3DS redirect) finalization ────────────────────
  useEffect(() => {
    const finalize = searchParams.get("finalize");
    const redirectStatus = searchParams.get("redirect_status");
    if (finalize !== "1") return;

    (async () => {
      try {
        const raw = sessionStorage.getItem("cf_checkout_ctx");
        const ctx = raw ? JSON.parse(raw) : null;
        if (redirectStatus === "succeeded" && ctx) {
          await fetch("/api/stripe/activate-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscription_id: ctx.subscription_id,
              email: ctx.email,
              username: ctx.username,
              target_id: ctx.target_id,
            }),
          });
          track("subscription_activated", { via_3ds_redirect: true });
          const params = new URLSearchParams();
          if (ctx.email) params.set("email", ctx.email);
          if (ctx.username) params.set("username", ctx.username);
          if (ctx.target_id) params.set("targetId", ctx.target_id);
          setFinalizePhase("success");
          setTimeout(() => {
            void redirectAfterPayment(params);
          }, 1800);
          return;
        }
      } catch (err) {
        console.error("finalize failed:", err);
      }
      // Failed / unknown — drop back to the paywall.
      setFinalizing(false);
      setStep("paywall");
      setShowCheckout(true);
    })();
  }, [searchParams, router]);

  const displayName = username || "this account";
  const total =
    (tier === "premium" ? PREMIUM_PRICES : BASE_PRICES)[cadence] +
    (emailAlerts ? ALERTS_ADDON[cadence] : 0);

  const handlePaymentSuccess = () => {
    track("subscription_activated", {
      cadence,
      tier,
      email_alerts: emailAlerts,
      ...(username ? { username } : {}),
    });
    const params = new URLSearchParams();
    if (email) params.set("email", email.trim());
    if (username) params.set("username", username);
    if (targetId) params.set("targetId", targetId);
    void redirectAfterPayment(params);
  };

  // Persist the lead as soon as we have an email (non-blocking).
  const saveLead = (extra?: { relationship?: string }) => {
    if (!isValidEmail(email)) return;
    fetch("/api/onboarding/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        username: username || undefined,
        targetId: targetId || undefined,
        ...(extra?.relationship ? { relationship: extra.relationship } : {}),
      }),
    }).catch(() => {
      /* non-blocking */
    });
  };

  // ── Header ────────────────────────────────────────────────────
  const progressSteps: Step[] = ["email", "relationship", "scanning", "paywall"];
  const currentIdx = progressSteps.indexOf(step);

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* Header */}
      <nav className="sticky top-0 z-50 ramp-glass">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2 text-xs font-bold text-[#777777]">
            <Lock className="w-3.5 h-3.5" />
            Secure setup
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-3">
          <div className="h-1.5 bg-[#EDEDE8] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#E7F256] border-r-2 border-[#121212]"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIdx + 1) / progressSteps.length) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
        {finalizing ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {finalizePhase === "success" ? (
              <>
                <div className="w-14 h-14 rounded-full bg-[#E7F256] flex items-center justify-center">
                  <Check className="w-7 h-7 text-[#121212]" strokeWidth={3} />
                </div>
                <p className="text-lg font-bold text-[#121212]">
                  Payment successful
                </p>
                <p className="text-[#555555] text-sm font-semibold">
                  Redirecting you to create your account…
                </p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full border-4 border-[#121212] border-t-[#E7F256] animate-spin" />
                <p className="text-[#555555] text-sm font-semibold">
                  Confirming your payment…
                </p>
              </>
            )}
          </div>
        ) : (
        <AnimatePresence mode="wait">
          {/* ── STEP 1: EMAIL ─────────────────────────────────── */}
          {step === "email" && (
            <EmailStep
              key="email"
              username={displayName}
              email={email}
              setEmail={setEmail}
              onContinue={() => {
                saveLead();
                track("lead_captured", { has_username: !!username });
                setStep("relationship");
              }}
            />
          )}

          {/* ── STEP 2: RELATIONSHIP ─────────────────────────── */}
          {step === "relationship" && (
            <RelationshipStep
              key="relationship"
              username={displayName}
              selected={relationship}
              onSelect={(value) => {
                setRelationship(value);
                saveLead({ relationship: value });
                track("relationship_selected", { relationship: value });
                setStep("scanning");
              }}
            />
          )}

          {/* ── STEP 3: SCANNING ─────────────────────────────── */}
          {step === "scanning" && (
            <ScanningStep
              key="scanning"
              username={username}
              onDone={() => setStep("paywall")}
            />
          )}

          {/* ── STEP 4: PAYWALL ──────────────────────────────── */}
          {step === "paywall" && (
            <PaywallStep
              key="paywall"
              username={displayName}
              cadence={cadence}
              setCadence={(c) => {
                setCadence(c);
                track("billing_cadence_selected", {
                  cadence: c,
                  source: "onboarding",
                });
              }}
              tier={tier}
              setTier={(t) => {
                setTier(t);
                track("plan_tier_selected", { tier: t, source: "onboarding" });
              }}
              emailAlerts={emailAlerts}
              setEmailAlerts={(v) => {
                setEmailAlerts(v);
                track("email_alerts_toggled", {
                  state: v ? "on" : "off",
                  cadence,
                  source: "onboarding",
                });
              }}
              total={total}
              openFaq={openFaq}
              setOpenFaq={(i) => {
                setOpenFaq(i);
                if (i !== null) {
                  track("paywall_faq_opened", { question: PAYWALL_FAQS[i].q });
                }
              }}
              onOpenCheckout={() => {
                track("checkout_started", {
                  cadence,
                  tier,
                  email_alerts: emailAlerts,
                });
                setShowCheckout(true);
              }}
            />
          )}
        </AnimatePresence>
        )}
      </main>

      {/* ── In-page checkout bottom sheet ─────────────────────── */}
      <AnimatePresence>
        {showCheckout && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setShowCheckout(false);
                track("checkout_sheet_closed", {
                  cadence,
                  tier,
                  email_alerts: emailAlerts,
                });
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF] rounded-t-[28px] border-t border-[#E2E2DC] max-h-[82%] overflow-y-auto shadow-[0_-12px_45px_rgba(0,0,0,0.2)]"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-[#D9D9D2]" />
              </div>
              <div className="px-5 py-2.5 flex items-center justify-between border-b border-[#E2E2DC]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#121212] font-extrabold text-base">
                      Complete purchase
                    </span>
                    <Badge variant="mono" size="sm">
                      {cadence === "weekly" ? "Weekly" : "Quarterly"}
                    </Badge>
                    <Badge variant="mono" size="sm">
                      {tier === "premium" ? "Premium" : "Basic"}
                    </Badge>
                  </div>
                  <p className="text-[#555555] text-xs font-semibold mt-0.5">
                    {cadence === "weekly"
                      ? `$${total.toFixed(2)}/week`
                      : `$${weeklyRate(total, "quarterly").toFixed(2)}/wk · $${total.toFixed(2)} billed quarterly`}
                    {emailAlerts && " · with email alerts"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCheckout(false);
                    track("checkout_sheet_closed", {
                      cadence,
                      tier,
                      email_alerts: emailAlerts,
                    });
                  }}
                  className="w-8 h-8 rounded-full bg-[#F3F3EF] hover:bg-[#EDEDE8] text-[#555555] flex items-center justify-center text-sm font-bold transition-colors"
                  aria-label="Close checkout"
                >
                  ✕
                </button>
              </div>
              <div className="p-3 sm:p-4">
                <EmbeddedCheckout
                  cadence={cadence}
                  tier={tier}
                  emailAlerts={emailAlerts}
                  email={email}
                  username={username || undefined}
                  targetId={targetId || undefined}
                  relationship={relationship || undefined}
                  onSuccess={handlePaymentSuccess}
                />
              </div>
              <div className="px-5 pb-6 pt-1 text-center">
                <p className="text-[#777777] text-xs font-medium flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#047857]" />
                  256-bit encrypted · Cancel anytime in 1-click
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── STEP COMPONENTS ───────────────────────────────────────────────

function EmailStep({
  username,
  email,
  setEmail,
  onContinue,
}: {
  username: string;
  email: string;
  setEmail: (v: string) => void;
  onContinue: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const ready = isValidEmail(email);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full px-6 pt-10 sm:pt-16 pb-8"
    >
      <div className="text-center">
        <Badge variant="mono" size="sm" className="mb-4">
          STEP 1 OF 3 · YOUR EMAIL
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212] leading-tight">
          Where should we send {username}&apos;s updates?
        </h1>
        <p className="text-[#555555] text-sm font-medium max-w-xs mx-auto mt-3">
          We&apos;ll email you the moment they follow or unfollow someone — and
          your receipt goes here too.
        </p>
      </div>

      <div className="my-8">
        <Input
          ref={inputRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ready && onContinue()}
          placeholder="you@email.com"
          className="py-4 text-center text-lg border-[#E2E2DC] focus:border-[#121212] rounded-2xl"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <p className="text-[#777777] text-[11px] font-medium flex items-center justify-center gap-1.5 mt-3">
          <Lock className="w-3.5 h-3.5 text-[#047857]" /> 100% private · zero spam
        </p>
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!ready}
        onClick={onContinue}
        rightIcon={<ArrowRight className="w-4 h-4" />}
        className="font-extrabold"
      >
        Continue
      </Button>
    </motion.div>
  );
}

function RelationshipStep({
  username,
  selected,
  onSelect,
}: {
  username: string;
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 pt-10 sm:pt-16 pb-8"
    >
      <div className="text-center mb-8">
        <Badge variant="mono" size="sm" className="mb-4">
          STEP 2 OF 3 · CONTEXT
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212] leading-tight">
          Who is {username} to you?
        </h1>
        <p className="text-[#555555] text-sm font-medium mt-3">
          Helps tailor your monitoring alerts and report formatting.
        </p>
      </div>

      <div className="space-y-3">
        {RELATIONSHIP_OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between ${
                active
                  ? "border-[#121212] bg-[#E7F256]/20 shadow-sm"
                  : "border-[#E2E2DC] bg-[#FFFFFF] hover:border-[#121212] hover:bg-[#F9F9F7]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{opt.emoji}</span>
                <p className="font-extrabold text-sm text-[#121212]">{opt.label}</p>
              </div>
              {active && (
                <span className="w-5 h-5 rounded-full bg-[#121212] text-[#E7F256] flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function ScanningStep({
  username,
  onDone,
}: {
  username: string;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    track("scanning_started", { username: username || undefined });
    const total = 10000; // ~10 seconds
    const tick = 100;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += tick;
      setProgress(Math.min(100, Math.round((elapsed / total) * 100)));
      setMsgIdx(Math.min(SCAN_MESSAGES.length - 1, Math.floor((elapsed / total) * SCAN_MESSAGES.length)));
      if (elapsed >= total) {
        clearInterval(interval);
        track("scanning_completed", { username: username || undefined });
        onDone();
      }
    }, tick);
    return () => clearInterval(interval);
  }, [onDone, username]);

  const message = SCAN_MESSAGES[msgIdx].replace("{u}", `@${username}` || "…");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full px-6 py-16 text-center"
    >
      {/* Radar spinner */}
      <div className="relative w-28 h-28 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-[#EDEDE8]" />
        <div className="absolute inset-0 rounded-full border-2 border-[#E7F256] border-t-[#121212] animate-spin" />
        <div className="absolute inset-5 rounded-full border border-[#E2E2DC]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Search className="w-8 h-8 text-[#121212]" />
        </div>
      </div>

      <Badge variant="lime" size="md" className="mb-4">
        <span className="w-2 h-2 rounded-full bg-[#121212] animate-ping mr-1.5 inline-block" />
        Scanning in progress
      </Badge>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212] leading-tight mb-2">
        Pulling {username ? `@${username}` : "their"} full activity
      </h1>
      <p className="text-[#555555] text-sm font-medium min-h-[40px]">{message}</p>

      <div className="w-full max-w-xs mt-8">
        <div className="w-full h-2.5 bg-[#EDEDE8] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#E7F256] border-r-2 border-[#121212]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
        <p className="text-xs font-mono font-bold text-[#555555] mt-2">{progress}%</p>
      </div>
    </motion.div>
  );
}

function PaywallStep({
  username,
  cadence,
  setCadence,
  tier,
  setTier,
  emailAlerts,
  setEmailAlerts,
  total,
  openFaq,
  setOpenFaq,
  onOpenCheckout,
}: {
  username: string;
  cadence: Cadence;
  setCadence: (c: Cadence) => void;
  tier: Tier;
  setTier: (t: Tier) => void;
  emailAlerts: boolean;
  setEmailAlerts: (v: boolean) => void;
  total: number;
  openFaq: number | null;
  setOpenFaq: (i: number | null) => void;
  onOpenCheckout: () => void;
}) {
  const displayWeekly = weeklyRate(total, cadence);
  const alertsWeekly = alertsWeeklyRate(cadence);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 max-w-md mx-auto w-full px-5 sm:px-6 pt-8 pb-32 space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <Badge variant="lime" size="sm" className="mb-1">
          YOUR REPORT IS READY
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212] leading-tight">
          We found {username}&apos;s recent follows
        </h1>
        <p className="text-[#555555] text-sm font-medium">
          Unlock the full list and get alerted on every change.
        </p>
      </div>

      {/* Plan tier toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-full border border-[#E2E2DC] bg-[#F9F9F7] p-1">
          <button
            onClick={() => setTier("base")}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
              tier === "base"
                ? "bg-[#121212] text-[#FFFFFF]"
                : "text-[#555555] hover:text-[#121212]"
            }`}
          >
            Basic
          </button>
          <button
            onClick={() => setTier("premium")}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all flex items-center gap-1.5 ${
              tier === "premium"
                ? "bg-[#121212] text-[#FFFFFF]"
                : "text-[#555555] hover:text-[#121212]"
            }`}
          >
            Premium
            <span className="text-[10px] font-bold bg-[#E7F256] text-[#121212] px-1.5 py-0.5 rounded-full">
              Unlimited
            </span>
          </button>
        </div>
      </div>
      <p className="text-center text-[11px] text-[#777777] font-semibold mt-2">
        {tier === "base"
          ? "3 concurrent accounts included"
          : "5 concurrent accounts included"}
      </p>

      {/* Billing cadence toggle */}
      <div className="flex items-center justify-center mt-3">
        <div className="inline-flex items-center rounded-full border border-[#E2E2DC] bg-[#F9F9F7] p-1">
          <button
            onClick={() => setCadence("weekly")}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
              cadence === "weekly"
                ? "bg-[#121212] text-[#FFFFFF]"
                : "text-[#555555] hover:text-[#121212]"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setCadence("quarterly")}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all flex items-center gap-1.5 ${
              cadence === "quarterly"
                ? "bg-[#121212] text-[#FFFFFF]"
                : "text-[#555555] hover:text-[#121212]"
            }`}
          >
            Quarterly
            <span className="text-[10px] font-bold bg-[#E7F256] text-[#121212] px-1.5 py-0.5 rounded-full">
              Save 62%
            </span>
          </button>
        </div>
      </div>

      {/* Plan card */}
      <Card
        padding="lg"
        className="border-2 border-[#E7F256] shadow-[0_4px_20px_rgba(231,242,86,0.35)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#121212]">
              {tier === "premium" ? "Premium" : "Basic"} ·{" "}
              {cadence === "weekly" ? "Weekly" : "Quarterly"}
            </h3>
            <p className="text-sm text-[#555555]">
              {tier === "base"
                ? "3 concurrent accounts included"
                : "5 concurrent accounts included"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="lime" size="sm">
              <Zap className="w-3 h-3" /> {cadence === "quarterly" ? "SAVE 62%" : "60% OFF"}
            </Badge>
            {cadence === "quarterly" && (
              <Badge variant="lime" size="sm">
                <Sparkles className="w-3 h-3" /> Best value
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-bold text-[#999999] line-through decoration-[#B91C1C]/70">
            {anchorPrice(cadence, emailAlerts, tier)}
          </span>
          <span className="text-5xl font-extrabold tracking-tight text-[#121212]">
            ${displayWeekly.toFixed(2)}
          </span>
          <span className="text-sm font-semibold text-[#777777]">/week</span>
        </div>
        <p className="text-xs text-[#888888] mt-2">
          {cadence === "weekly" ? (
            "Billed weekly · extra slots $1/week each · Cancel anytime"
          ) : (
            <>
              <strong className="text-[#121212] font-extrabold">${total.toFixed(2)} billed quarterly</strong> (every 3 months) · extra slots $14/quarter each
            </>
          )}
          {emailAlerts && (
            <span className="text-[#047857] font-semibold text-[11px]">
              {" "}· includes +${alertsWeekly.toFixed(2)}/wk email alerts
            </span>
          )}
        </p>

        {/* Email alerts upsell — clean, spacious card with full-width readable text */}
        <div
          role="button"
          tabIndex={0}
          aria-checked={emailAlerts}
          onClick={() => setEmailAlerts(!emailAlerts)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setEmailAlerts(!emailAlerts);
            }
          }}
          className={`mt-5 w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 cursor-pointer ${
            emailAlerts
              ? "border-[#121212] bg-[#E7F256]/15 shadow-sm"
              : "border-[#E2E2DC] bg-[#F9F9F7] hover:border-[#C9C9C0]"
          }`}
        >
          {/* Header Row: Icon, Title, Price Tag, and Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  emailAlerts ? "bg-[#121212] text-[#E7F256]" : "bg-[#EDEDE8] text-[#555555]"
                }`}
              >
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm sm:text-base font-extrabold text-[#121212] leading-tight">
                  Email Change Alerts
                </h4>
                <p className="text-xs font-bold text-[#047857] mt-0.5">
                  +${alertsWeekly.toFixed(2)}/wk{" "}
                  <span className="text-[#777777] font-normal">
                    ({cadence === "weekly" ? "billed weekly" : "<$1/wk · $10 billed quarterly"})
                  </span>
                </p>
              </div>
            </div>

            <div
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                emailAlerts ? "bg-[#121212]" : "bg-[#D9D9D2]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  emailAlerts ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </div>
          </div>

          {/* Full-width 2-sentence readable description */}
          <p className="text-xs text-[#555555] font-medium leading-relaxed mt-3 pt-3 border-t border-[#E2E2DC]/80">
            Get instant notifications the moment they follow or unfollow someone. We check their account every 48 hours and send detailed change alerts straight to your inbox.
          </p>
        </div>

        {/* Features */}
        <ul className="mt-5 space-y-2.5 border-t border-[#E2E2DC] pt-5">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-[#555555]">
              <span className="w-5 h-5 rounded-full bg-[#E7F256] border border-black/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-[#121212]" strokeWidth={3} />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* FAQ */}
      <div className="space-y-2">
        <h2 className="text-base font-extrabold text-[#121212] text-center">
          People often ask
        </h2>
        {PAYWALL_FAQS.map((faq, idx) => {
          const isOpen = openFaq === idx;
          return (
            <div key={idx} className="bg-[#F9F9F7] border border-[#E2E2DC] rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(isOpen ? null : idx)}
                className="w-full px-3.5 py-3 text-left flex items-center justify-between gap-3 text-[#121212] font-bold text-xs"
              >
                <span>{faq.q}</span>
                <span className="text-[#121212] text-base leading-none">{isOpen ? "−" : "+"}</span>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-3.5 pb-3 text-[#555555] text-xs font-medium border-t border-[#E2E2DC] pt-2"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Trust strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-[#555555]">
        <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#047857]" /> 100% Private</span>
        <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#121212]" /> No Instagram login</span>
        <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-[#121212]" /> Target never alerted</span>
      </div>

      {/* Sticky subscribe bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-5 pb-5 pt-3 bg-gradient-to-t from-[#FFFFFF] via-[#FFFFFF]/95 to-transparent">
        <div className="max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-[#555555] font-semibold">
              {cadence === "weekly" ? "Weekly" : `Quarterly ($${total.toFixed(2)})`}
              {emailAlerts ? " + alerts" : ""}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#999999] font-bold line-through">
                {anchorPrice(cadence, emailAlerts, tier)}
              </span>
              <span className="text-[#121212] font-extrabold text-sm">
                {cadence === "quarterly" ? `$${displayWeekly.toFixed(2)}/wk` : `$${total.toFixed(2)}/week`}
              </span>
            </span>
          </div>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onOpenCheckout}
            leftIcon={<Sparkles className="w-4 h-4 text-[#121212]" />}
            className="font-extrabold"
          >
            Get Started — See who they follow
          </Button>
          <p className="text-center text-[11px] text-[#777777] font-semibold">
            🔒 Cancel anytime · Secure checkout
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-3 border-[#121212] border-t-[#E7F256] animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
