"use client";

import { useEffect, useRef, useState } from "react";
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
  Trash2,
} from "lucide-react";
import { Avatar, Badge, Button, Card } from "@/design-system";
import { AppShell } from "@/components/app/app-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { identify, track } from "@/lib/mixpanel";
import {
  formatRelative,
  type TrackedTarget,
} from "@/lib/account-types";
import { scanCreditsForFollowingCount } from "@/lib/scan-credit-policy";
import {
  AccountDataRequestError,
  useAccountData,
} from "@/lib/account-data-client";

export default function DashboardPage() {
  const router = useRouter();
  const { data, loading, error: loadError, refresh, update } = useAccountData();
  const [error, setError] = useState("");
  const [targetAction, setTargetAction] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [justSubscribed, setJustSubscribed] = useState(false);
  const trackedView = useRef(false);

  useEffect(() => {
    if (!(loadError instanceof AccountDataRequestError)) return;
    if (loadError.status === 401) router.replace("/login?next=/dashboard");
  }, [loadError, router]);

  useEffect(() => {
    if (!data || trackedView.current) return;
    trackedView.current = true;
    identify(data.user.id, { $email: data.user.email ?? undefined });
    track("dashboard_viewed", {
      has_active_subscription: data.hasActiveSubscription,
    });
  }, [data]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("subscribed") !== "1") return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const next = await refresh(true);
          if (cancelled) return;
          if (next.hasActiveSubscription || attempt === 5) {
            if (next.hasActiveSubscription) setJustSubscribed(true);
            window.history.replaceState({}, "", "/dashboard");
            return;
          }
        } catch (refreshError) {
          if (
            refreshError instanceof AccountDataRequestError &&
            refreshError.status === 401
          ) {
            router.replace("/login?next=/dashboard");
            return;
          }
        }
        if (attempt < 5) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, router]);

  const toggleTrackedAccount = async (target: TrackedTarget) => {
    if (targetAction) return;
    setTargetAction(target.id);
    setError("");
    const action = target.monitoring_enabled ? "stop" : "start";
    const requiredScanCredits = scanCreditsForFollowingCount(
      target.following_count
    );
    if (
      action === "start" &&
      !window.confirm(
        `Automatic count checks are free. Complete scans of @${target.username} currently use ${requiredScanCredits} ${requiredScanCredits === 1 ? "scan credit" : "scan credits"}. Approve and resume?`
      )
    ) {
      setTargetAction(null);
      return;
    }
    try {
      const response = await fetch("/api/instagram/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: target.id,
          action,
          ...(action === "start"
            ? {
                scanCreditsConfirmed: true,
                quotedScanCredits: requiredScanCredits,
              }
            : {}),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error || "The tracked account could not be updated.");
        return;
      }
      update((current) => ({
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
            }));
      track("monitoring_toggled", { action, username: target.username });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTargetAction(null);
    }
  };

  const removeTrackedAccount = async (target: TrackedTarget) => {
    if (targetAction) return;
    setTargetAction(target.id);
    setError("");
    try {
      const response = await fetch("/api/instagram/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: target.id, action: "remove" }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error || "This account could not be removed.");
        return;
      }
      setConfirmRemoveId(null);
      update((current) => ({
              ...current,
              removal: json.removal || current.removal,
              capacity: current.capacity
                ? (() => {
                    const activeAccounts = Math.max(
                      0,
                      current.capacity.activeAccounts -
                        (target.monitoring_enabled ? 1 : 0)
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
              subscriptions: current.subscriptions.filter(
                (subscription) => subscription.target?.id !== target.id
              ),
            }));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTargetAction(null);
    }
  };

  const trackedTargets = (data?.subscriptions || [])
    .map((s) => s.target)
    .filter((t): t is TrackedTarget => !!t);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
            Tracked accounts
          </h1>
          <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
            Open a profile to see follows, unfollows, and history. Billing and
            slots live in Account.
          </p>
        </div>

        {justSubscribed && (
          <Card variant="highlight" className="border-emerald-500/30">
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Subscription active. Monitoring is ready.
            </p>
          </Card>
        )}

        {(error || loadError) && (
          <Card variant="subtle" className="border-rose-500/30">
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error || loadError?.message}</p>
          </Card>
        )}

        {data?.hasActiveSubscription && data.capacity && (
          <Card variant="subtle" padding="md">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-[var(--muted-foreground)]">
                  <strong className="font-extrabold text-[var(--foreground)]">
                    {data.capacity.activeAccounts} of {data.capacity.totalAccounts}
                  </strong>{" "}
                  concurrent slots in use
                </p>
                <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                  <strong className="text-[var(--foreground)]">{data.credits.scan_included}</strong>{" "}
                  automatic scan credits left this week · {data.credits.rescan_credits}{" "}
                  {data.credits.rescan_credits === 1 ? "rescan credit" : "rescan credits"}
                </p>
              </div>
              <Link
                href="/account"
                className="text-xs font-bold text-[var(--foreground)] underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Manage slots and billing
              </Link>
            </div>
          </Card>
        )}

        {data?.hasActiveSubscription ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[var(--foreground)]">
                {trackedTargets.length}{" "}
                {trackedTargets.length === 1 ? "account" : "accounts"}
              </h2>
              <Link
                href="/app/add-account"
                className="text-xs font-bold text-[var(--foreground)] underline underline-offset-2 hover:opacity-80 transition-opacity"
                onClick={() => track("add_account_clicked")}
              >
                + Add account
              </Link>
            </div>

            {data.removal?.tier === "base" && (
              <p className="mb-3 text-xs font-medium text-[var(--muted-foreground)]">
                {data.removal.canRemove
                  ? "Basic can remove a tracked account once every 7 days. Pause anytime. Premium can pause, resume, and delete without a wait."
                  : `Basic can remove a tracked account once every 7 days. Next removal on ${
                      data.removal.nextRemoveAt
                        ? new Date(data.removal.nextRemoveAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" }
                          )
                        : "a later date"
                    }. Upgrade to Premium to delete anytime.`}
              </p>
            )}
            {data.removal?.tier === "premium" && (
              <p className="mb-3 text-xs font-medium text-[var(--muted-foreground)]">
                Premium: pause, resume, or delete tracked accounts anytime.
              </p>
            )}

            {trackedTargets.length === 0 ? (
              <Card variant="subtle" className="py-10 text-center">
                <Eye className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" />
                <p className="mx-auto max-w-xs text-sm font-medium text-[var(--muted-foreground)]">
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
                    padding="none"
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                  >
                    {/* Profile info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <Avatar
                        src={t.avatar_url}
                        username={t.username}
                        isVerified={t.is_verified}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/track/${encodeURIComponent(t.username)}`}
                            className="truncate font-extrabold text-[var(--foreground)] hover:underline text-base"
                          >
                            @{t.username}
                          </Link>
                          {t.monitoring_enabled ? (
                            <Badge
                              variant="lime"
                              size="sm"
                              className="inline-flex items-center gap-1 shrink-0"
                            >
                              <Bell className="h-3 w-3" /> Monitoring
                            </Badge>
                          ) : (
                            <Badge variant="mono" size="sm" className="shrink-0">
                              Paused
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--muted-foreground)] flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[var(--foreground)]">
                            {t.following_count.toLocaleString()} following
                          </span>
                          <span className="text-[var(--border)]">·</span>
                          <span>Last full scan {formatRelative(t.last_scanned_at)}</span>
                        </p>
                        {data.subscriptions.find((subscription) => subscription.target?.id === t.id)?.scan_credit_blocked_at && (
                          <p className="mt-1 text-xs font-bold text-amber-700">
                            Full scan waiting for {data.subscriptions.find((subscription) => subscription.target?.id === t.id)?.scan_credit_required || 1} scan credits or updated approval ·{" "}
                            <Link
                              href={`/app/add-account?username=${encodeURIComponent(t.username)}&targetId=${encodeURIComponent(t.id)}`}
                              className="underline underline-offset-2"
                            >
                              Review
                            </Link>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t border-[var(--border)] sm:border-0 justify-between sm:justify-end shrink-0 w-full sm:w-auto">
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
                        className="flex-1 sm:flex-initial"
                      >
                        {t.monitoring_enabled ? "Pause" : "Resume"}
                      </Button>

                      <Link
                        href={`/track/${encodeURIComponent(t.username)}`}
                        className="flex-1 sm:flex-initial"
                        onClick={() =>
                          track("tracked_account_opened", {
                            username: t.username,
                          })
                        }
                      >
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          rightIcon={<ArrowRight className="h-4 w-4" />}
                        >
                          Open
                        </Button>
                      </Link>

                      {confirmRemoveId === t.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={targetAction === t.id}
                            onClick={() => removeTrackedAccount(t)}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setConfirmRemoveId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          disabled={data.removal?.canRemove === false}
                          onClick={() => {
                            if (data.removal?.canRemove === false) {
                              setError(
                                data.removal.nextRemoveAt
                                  ? `Basic can remove a tracked account once every 7 days. Next removal on ${new Date(
                                      data.removal.nextRemoveAt
                                    ).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    })}.`
                                  : "Basic can remove a tracked account once every 7 days."
                              );
                              return;
                            }
                            setConfirmRemoveId(t.id);
                          }}
                          className="text-[var(--muted-foreground)] hover:text-red-500 shrink-0 px-2 sm:px-3"
                          title="Delete tracked account"
                        >
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      )}
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
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[var(--foreground)]" />
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                    Change alerts
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    Emailed the moment they follow or unfollow someone.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <History className="mt-0.5 h-5 w-5 shrink-0 text-[var(--foreground)]" />
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                    Accumulating history
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    Every check builds a permanent timeline.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                    100% private
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
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
