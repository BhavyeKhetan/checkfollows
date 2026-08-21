"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Eye,
  History,
  Lock,
  Pause,
  Play,
} from "lucide-react";
import { Avatar, Badge, Button, Card } from "@/design-system";
import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/client";
import { identify, track } from "@/lib/mixpanel";
import {
  formatRelative,
  type AccountData,
  type TrackedTarget,
} from "@/lib/account-types";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState("");
  const [targetAction, setTargetAction] = useState<string | null>(null);
  const [justSubscribed, setJustSubscribed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/dashboard");
        return;
      }

      identify(user.id, { $email: user.email ?? undefined });

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const returningFromPurchase = urlParams.get("subscribed") === "1";
        const attempts = returningFromPurchase ? 6 : 1;
        for (let attempt = 0; attempt < attempts; attempt++) {
          const res = await fetch("/api/account", { cache: "no-store" });
          if (res.status === 401) {
            router.replace("/login?next=/dashboard");
            return;
          }
          const json = await res.json();
          if (cancelled) return;
          if (!json.success) {
            setError(json.error || "Failed to load dashboard");
            break;
          }
          if (json.hasActiveSubscription || attempt === attempts - 1) {
            setData(json);
            if (returningFromPurchase && json.hasActiveSubscription) {
              setJustSubscribed(true);
              window.history.replaceState({}, "", "/dashboard");
            }
            track("dashboard_viewed", {
              has_active_subscription: json.hasActiveSubscription,
            });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggleTrackedAccount = async (target: TrackedTarget) => {
    if (targetAction) return;
    setTargetAction(target.id);
    setError("");
    const action = target.monitoring_enabled ? "stop" : "start";
    try {
      const response = await fetch("/api/instagram/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: target.id, action }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error || "The tracked account could not be updated.");
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              capacity: current.capacity
                ? (() => {
                    const activeAccounts = Math.max(
                      0,
                      current.capacity.activeAccounts +
                        (action === "start" ? 1 : -1)
                    );
                    return {
                      ...current.capacity,
                      activeAccounts,
                      availableAccounts: Math.max(
                        0,
                        current.capacity.totalAccounts - activeAccounts
                      ),
                    };
                  })()
                : current.capacity,
              subscriptions: current.subscriptions.map((subscription) =>
                subscription.target?.id === target.id
                  ? {
                      ...subscription,
                      user_paused: action === "stop",
                      target: {
                        ...subscription.target,
                        monitoring_enabled: action === "start",
                      },
                    }
                  : subscription
              ),
            }
          : current
      );
      track("monitoring_toggled", { action, username: target.username });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTargetAction(null);
    }
  };

  const trackedTargets = (data?.subscriptions || [])
    .map((s) => s.target)
    .filter((t): t is TrackedTarget => !!t);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF]">
        <div className="border-3 h-8 w-8 animate-spin rounded-full border-[#121212] border-t-[#E7F256]" />
      </div>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div>
          <Badge variant="mono" size="sm" className="mb-3">
            DASHBOARD
          </Badge>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#121212] sm:text-3xl">
            Tracked accounts
          </h1>
          <p className="mt-1 text-sm font-medium text-[#555555]">
            Open a profile to see follows, unfollows, and history. Billing and
            slots live in Account.
          </p>
        </div>

        {justSubscribed && (
          <Card variant="highlight" className="border-[#86EFAC]">
            <p className="text-sm font-bold text-[#047857]">
              Subscription active. Monitoring is ready.
            </p>
          </Card>
        )}

        {error && (
          <Card variant="subtle" className="border-[#FCA5A5]">
            <p className="text-sm font-medium text-[#B91C1C]">{error}</p>
          </Card>
        )}

        {data?.hasActiveSubscription && data.capacity && (
          <Card variant="subtle" padding="md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#555555]">
                <strong className="text-[#121212]">
                  {data.capacity.activeAccounts} of {data.capacity.totalAccounts}
                </strong>{" "}
                concurrent slots in use
              </p>
              <Link
                href="/account"
                className="text-xs font-bold text-[#121212] underline underline-offset-2"
              >
                Manage slots and billing
              </Link>
            </div>
          </Card>
        )}

        {data?.hasActiveSubscription ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[#121212]">
                {trackedTargets.length}{" "}
                {trackedTargets.length === 1 ? "account" : "accounts"}
              </h2>
              <Link
                href="/app/add-account"
                className="text-xs font-bold text-[#121212] underline underline-offset-2"
                onClick={() => track("add_account_clicked")}
              >
                + Add account
              </Link>
            </div>

            {trackedTargets.length === 0 ? (
              <Card variant="subtle" className="py-10 text-center">
                <Eye className="mx-auto mb-3 h-8 w-8 text-[#555555]" />
                <p className="mx-auto max-w-xs text-sm font-medium text-[#555555]">
                  You&apos;re not tracking anyone yet. Search a profile to start
                  watching who they follow.
                </p>
                <Link href="/app/add-account" className="mt-4 inline-block">
                  <Button
                    variant="secondary"
                    size="sm"
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Search a profile
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-3">
                {trackedTargets.map((t) => (
                  <Card
                    key={t.id}
                    hoverable
                    padding="md"
                    className="flex items-center gap-4"
                  >
                    <Avatar
                      src={t.avatar_url}
                      username={t.username}
                      isVerified={t.is_verified}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold text-[#121212]">
                          {t.full_name || `@${t.username}`}
                        </span>
                        <Badge variant="mono" size="sm">
                          @{t.username}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-[#555555]">
                        <span>
                          {t.following_count.toLocaleString()} following
                        </span>
                        <span className="text-[#E2E2DC]">·</span>
                        <span>Last checked {formatRelative(t.last_scanned_at)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.monitoring_enabled ? (
                        <Badge
                          variant="lime"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Bell className="h-3 w-3" /> Monitoring
                        </Badge>
                      ) : (
                        <Badge variant="mono" size="sm">
                          Paused
                        </Badge>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={targetAction === t.id}
                        leftIcon={
                          t.monitoring_enabled ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )
                        }
                        onClick={() => toggleTrackedAccount(t)}
                      >
                        {t.monitoring_enabled ? "Pause" : "Resume"}
                      </Button>
                      <Link href={`/track/${encodeURIComponent(t.username)}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          rightIcon={<ArrowRight className="h-4 w-4" />}
                          onClick={() =>
                            track("tracked_account_opened", {
                              username: t.username,
                            })
                          }
                        >
                          Open
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <Card
              variant="subtle"
              padding="lg"
              className="mt-6 grid gap-6 sm:grid-cols-3"
            >
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#121212]" />
                <div>
                  <h3 className="text-sm font-extrabold text-[#121212]">
                    Change alerts
                  </h3>
                  <p className="mt-0.5 text-xs text-[#555555]">
                    Emailed the moment they follow or unfollow someone.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <History className="mt-0.5 h-5 w-5 shrink-0 text-[#121212]" />
                <div>
                  <h3 className="text-sm font-extrabold text-[#121212]">
                    Accumulating history
                  </h3>
                  <p className="mt-0.5 text-xs text-[#555555]">
                    Every check builds a permanent timeline.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#047857]" />
                <div>
                  <h3 className="text-sm font-extrabold text-[#121212]">
                    100% private
                  </h3>
                  <p className="mt-0.5 text-xs text-[#555555]">
                    The people you track are never notified.
                  </p>
                </div>
              </div>
            </Card>
          </section>
        ) : (
          <Card variant="highlight" padding="lg" className="py-10 text-center">
            <Lock className="mx-auto mb-3 h-8 w-8 text-[#121212]" />
            <Badge variant="lime" size="sm" className="mb-3">
              SUBSCRIPTION REQUIRED
            </Badge>
            <h2 className="text-xl font-extrabold">
              Unlock your tracking dashboard
            </h2>
            <p className="mx-auto mt-2 mb-5 max-w-md text-sm text-[#555555]">
              Subscribe to reveal tracked accounts, monitoring history, alerts,
              exports, and rescans.
            </p>
            <Link href={data?.canRenew ? "/account#renew-subscription" : "/app/pricing"}>
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={() =>
                  track("subscribe_cta_clicked", { location: "dashboard" })
                }
              >
                {data?.canRenew ? "Renew subscription" : "View subscription options"}
              </Button>
            </Link>
          </Card>
        )}
      </main>
    </AppShell>
  );
}
