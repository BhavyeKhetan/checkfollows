"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Coins, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Card } from "@/design-system";
import { AppShell } from "@/components/app/app-shell";
import { track } from "@/lib/mixpanel";
import { RescanBundleModal } from "@/components/tracking/rescan-bundle-modal";
import type { RescanBundle } from "@/lib/stripe";

interface PreviewTarget {
  id: string;
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  following_count?: number;
  follower_count?: number;
}

interface ScanQuote {
  requiredCredits: number;
  canAfford: boolean;
  credits: {
    included: number;
    purchased: number;
    total: number;
    weeklyAllowance: number;
    refreshAt: string;
    tier: "base" | "premium";
  };
}

export default function AddAccountClient({
  initialUsername = "",
  initialTargetId = "",
  postPurchase = false,
}: {
  initialUsername?: string;
  initialTargetId?: string;
  postPurchase?: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [quote, setQuote] = useState<ScanQuote | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [purchasingCredits, setPurchasingCredits] = useState(false);
  const [error, setError] = useState("");

  const loadQuote = useCallback(async (targetId: string) => {
    const response = await fetch(
      `/api/instagram/scan-quote?targetId=${encodeURIComponent(targetId)}`,
      { cache: "no-store" }
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      throw new Error(json.error || "Could not calculate the scan cost.");
    }
    setQuote(json);
    setConfirmed(false);
    return json as ScanQuote;
  }, []);

  const performSearch = useCallback(async (rawUsername: string) => {
    const clean = rawUsername.replace(/^@/, "").trim().toLowerCase();
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) {
      setError("Enter a valid Instagram username.");
      return;
    }
    setLoading(true);
    setError("");
    setTarget(null);
    setQuote(null);
    setConfirmed(false);
    track("search_submitted", { username: clean, source: "app" });
    try {
      const response = await fetch("/api/instagram/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean, stage: "preview" }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success || !json.target?.id) {
        setError(json.error || "That Instagram account could not be found.");
        return;
      }
      setTarget(json.target);
      setUsername(clean);
      await loadQuote(json.target.id);
    } catch {
      setError("That account was found, but its scan cost could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loadQuote]);

  const searchAccount = async (event: FormEvent) => {
    event.preventDefault();
    await performSearch(username);
  };

  useEffect(() => {
    if (!initialUsername) return;
    const timer = window.setTimeout(() => {
      void performSearch(initialUsername);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialUsername, initialTargetId, performSearch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") !== "rescan_credits" || params.get("success") !== "true") {
      return;
    }
    if (!target?.id) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          if (cancelled) return;
          try {
            await loadQuote(target.id);
          } catch {
            /* Webhook delivery can briefly lag the Checkout redirect. */
          }
          if (attempt < 3) {
            await new Promise((resolve) => window.setTimeout(resolve, 1200));
          }
        }
        if (cancelled) return;
        const url = new URL(window.location.href);
        url.searchParams.delete("purchase");
        url.searchParams.delete("success");
        window.history.replaceState({}, "", url.toString());
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [target?.id, loadQuote]);

  const addAccount = async () => {
    if (!target || !quote || !confirmed) return;
    setAdding(true);
    setError("");
    try {
      const attach = await fetch("/api/instagram/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: target.id,
          action: "start",
          scanCreditsConfirmed: true,
          quotedScanCredits: quote.requiredCredits,
        }),
      });
      const attachJson = await attach.json().catch(() => ({}));
      if (!attach.ok) {
        if (attachJson.quote) {
          setQuote(attachJson.quote);
          setConfirmed(false);
        }
        if (attachJson.needsCredits) setShowCreditsModal(true);
        setError(attachJson.error || "This account could not be added.");
        return;
      }

      track("tracked_account_added", { username: target.username });
      router.push(`/track/${encodeURIComponent(target.username)}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const returnPath = target
    ? `/app/add-account?username=${encodeURIComponent(target.username)}&targetId=${encodeURIComponent(target.id)}${postPurchase ? "&postPurchase=1" : ""}`
    : "/app/add-account";

  const purchaseWithCheckout = async (bundle: RescanBundle) => {
    const response = await fetch("/api/stripe/one-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "rescan_credits",
        bundle,
        targetId: target?.id,
        username: target?.username,
        returnPath,
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.url) {
      throw new Error(json.error || "Could not start checkout.");
    }
    window.location.assign(json.url);
  };

  const handleSelectBundle = async (
    bundle: RescanBundle,
    changePaymentMethod = false
  ) => {
    setPurchasingCredits(true);
    setError("");
    try {
      if (!changePaymentMethod) {
        const response = await fetch("/api/stripe/one-click-charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "rescan_credits",
            bundle,
            targetId: target?.id,
            username: target?.username,
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (json.success && target?.id) {
          await loadQuote(target.id);
          setShowCreditsModal(false);
          return;
        }
      }
      await purchaseWithCheckout(bundle);
    } catch (purchaseError) {
      if (!changePaymentMethod) {
        try {
          await purchaseWithCheckout(bundle);
          return;
        } catch {
          /* show the original error below */
        }
      }
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "Could not purchase scan credits."
      );
    } finally {
      setPurchasingCredits(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Badge variant="lime" className="mb-3">
          {postPurchase ? "PAYMENT COMPLETE · CONFIRM YOUR FIRST SCAN" : "ADD A TRACKED ACCOUNT"}
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Who do you want to monitor?</h1>
        <p className="mt-2 text-sm font-medium text-[var(--muted-foreground)]">
          Search a public Instagram username. They are never notified.
        </p>

        <form onSubmit={searchAccount} className="mt-6 flex gap-2 rounded-2xl border-2 border-[var(--border-dark)] bg-[var(--surface)] p-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
            <Search className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="instagram_username"
              autoCapitalize="none"
              autoCorrect="off"
              className="min-w-0 flex-1 py-2 text-base font-semibold bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
            />
          </div>
          <Button type="submit" variant="primary" isLoading={loading}>Search</Button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
        )}

        {target && quote && (
          <Card variant="highlight" padding="lg" className="mt-5">
            <div className="flex items-center gap-4">
              <Avatar
                src={target.avatar_url || null}
                username={target.username}
                isVerified={target.is_verified === true}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-extrabold text-[var(--foreground)]">{target.full_name || `@${target.username}`}</h2>
                <p className="text-sm font-bold text-[var(--muted-foreground)]">@{target.username}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {(target.following_count || 0).toLocaleString()} following · {(target.follower_count || 0).toLocaleString()} followers
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            </div>
            <div className="mt-5 rounded-2xl border-2 border-[var(--border-dark)] bg-[var(--surface)] p-4">
              <div className="flex items-start gap-3">
                <Coins className="mt-0.5 h-5 w-5 shrink-0 text-[var(--foreground)]" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                    Each complete scan currently uses {quote.requiredCredits}{" "}
                    {quote.requiredCredits === 1 ? "credit" : "credits"}
                  </h3>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--muted-foreground)]">
                    @{target.username} follows {(target.following_count || 0).toLocaleString()} accounts. One credit covers up to 1,000 following profiles.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">
                    Balance: {quote.credits.total} credits · {quote.credits.weeklyAllowance} included each week
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[var(--badge-bg)] p-3 text-xs font-medium leading-relaxed text-[var(--muted-foreground)]">
                The 48-hour count check is free. Credits are used only when we need the complete following list or when you request an immediate rescan. Failed or incomplete scans are refunded. If this account grows into a higher credit band, we will pause and ask you to approve the new amount.
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs font-bold text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#121212]"
                />
                <span>
                  I understand that each successful complete scan can use up to {quote.requiredCredits} {quote.requiredCredits === 1 ? "credit" : "credits"} at the account&apos;s current size.
                </span>
              </label>
            </div>

            {!quote.canAfford && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                You need {quote.requiredCredits - quote.credits.total} more {quote.requiredCredits - quote.credits.total === 1 ? "credit" : "credits"} for the first complete scan.
              </div>
            )}
            <Button
              variant="primary"
              size="lg"
              className="mt-5 w-full"
              isLoading={adding}
              onClick={quote.canAfford ? addAccount : () => setShowCreditsModal(true)}
              disabled={!confirmed && quote.canAfford}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {quote.canAfford
                ? `Confirm & start tracking · ${quote.requiredCredits} ${quote.requiredCredits === 1 ? "credit" : "credits"}/scan`
                : "Add scan credits to continue"}
            </Button>
            {quote.canAfford && (
              <button
                type="button"
                onClick={() => setShowCreditsModal(true)}
                className="mt-2 w-full text-center text-xs font-bold text-[var(--muted-foreground)] underline underline-offset-2"
              >
                Buy extra scan credits
              </button>
            )}
          </Card>
        )}

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)]">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <p className="text-xs font-medium text-[var(--muted-foreground)]">
            Only public Instagram accounts can be monitored. CheckFollows never logs into their account or sends them notifications.
          </p>
        </div>
      </main>
      <RescanBundleModal
        open={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
        username={target?.username || username}
        requiredCredits={quote?.requiredCredits}
        currentBalance={quote?.credits.total}
        onSelectBundle={handleSelectBundle}
        loading={purchasingCredits}
      />
    </AppShell>
  );
}
