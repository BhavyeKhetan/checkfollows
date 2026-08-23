"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app/app-shell";
import {
  ArrowLeft,
  UserPlus,
  UserMinus,
  TrendingUp,
  ExternalLink,
  Calendar,
  Bell,
  BellOff,
  CheckCircle2,
  RefreshCw,
  Clock,
  Download,
  Users,
} from "lucide-react";
import { Button, Badge, Card, Avatar, Tabs, StatCard } from "@/design-system";
import { track } from "@/lib/mixpanel";
import { RESCAN_BUNDLES, type RescanBundle, type ExportOptionTier } from "@/lib/stripe";
import { RescanBundleModal } from "@/components/tracking/rescan-bundle-modal";
import { ExportModal } from "@/components/tracking/export-modal";
import { scanCreditsForFollowingCount } from "@/lib/scan-credit-policy";

// ─── Types ──────────────────────────────────────────────────

export interface TrackedEvent {
  id: string;
  event_type: "NEW_FOLLOWING" | "STOPPED_FOLLOWING" | "NEW_FOLLOWER" | "LOST_FOLLOWER";
  instagram_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  detected_at: string;
  confirmed: boolean;
}

export interface TargetProfile {
  id: string;
  instagram_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  following_count: number;
  follower_count: number;
  last_scanned_at: string | null;
  next_scan_at: string | null;
  monitoring_enabled: boolean;
  monitoring_interval_hours: number;
}

// ─── Helpers ─────────────────────────────────────────────────

function eventIcon(type: string, size: "sm" | "md" = "md") {
  const cls = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  switch (type) {
    case "NEW_FOLLOWING":
      return <UserPlus className={`${cls} text-emerald-600`} />;
    case "STOPPED_FOLLOWING":
      return <UserMinus className={`${cls} text-rose-500`} />;
    case "NEW_FOLLOWER":
      return <TrendingUp className={`${cls} text-blue-600`} />;
    case "LOST_FOLLOWER":
      return <TrendingUp className={`${cls} text-amber-500 rotate-180`} />;
    default:
      return <Clock className={`${cls} text-[#555555]`} />;
  }
}

function eventLabel(type: string) {
  switch (type) {
    case "NEW_FOLLOWING": return "Started following";
    case "STOPPED_FOLLOWING": return "Stopped following";
    case "NEW_FOLLOWER": return "New follower";
    case "LOST_FOLLOWER": return "Lost follower";
    default: return type;
  }
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatNextCheck(iso: string | null): string {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return "Soon";
  if (diffHrs < 24) return `~${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `~${diffDays}d`;
}

// ─── Page ───────────────────────────────────────────────────

interface TrackPageClientProps {
  username: string;
  userEmail: string;
  initialTarget: TargetProfile;
  initialEvents: TrackedEvent[];
  initialCredits: {
    export: number;
    rescan_credits: number;
    mutuals: number;
    unlimited_export?: boolean;
    scan_included: number;
    scan_purchased: number;
    scan_weekly_allowance: number;
    scan_refresh_at: string | null;
  };
}

export default function TrackPageClient({
  username,
  userEmail,
  initialTarget,
  initialEvents,
  initialCredits,
}: TrackPageClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<TargetProfile | null>(initialTarget);
  const [events, setEvents] = useState<TrackedEvent[]>(initialEvents);
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [togglingMonitoring, setTogglingMonitoring] = useState(false);
  const [credits, setCredits] = useState(initialCredits);
  const [rescanning, setRescanning] = useState(false);
  const [showRescanModal, setShowRescanModal] = useState(false);
  const [purchasingBundle, setPurchasingBundle] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [purchasingExport, setPurchasingExport] = useState(false);
  const [mutualUsername, setMutualUsername] = useState("");
  const [mutualLoading, setMutualLoading] = useState(false);
  const [mutualError, setMutualError] = useState("");
  const [mutualResult, setMutualResult] = useState<{
    otherUsername: string;
    mutualCount: number;
    mutuals: Array<{
      userId: string;
      username: string;
      fullName: string | null;
      avatarUrl: string | null;
      isVerified: boolean;
    }>;
  } | null>(null);

  // Authentication and paid access are enforced by the parent Server
  // Component before any timeline HTML is rendered.
  useEffect(() => {
    track("tracking_page_viewed", {
      username,
      monitoring_enabled: initialTarget.monitoring_enabled,
      events_count: initialEvents.length,
    });
  }, [username, initialTarget.monitoring_enabled, initialEvents.length]);

  const loadData = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const eventsRes = await fetch(
        `/api/instagram/events?username=${encodeURIComponent(username)}`
      );
      const eventsData = await eventsRes.json();

      if (eventsRes.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/track/${username}`)}`);
        return;
      }
      if (eventsRes.status === 402) {
        router.replace("/app/pricing");
        return;
      }
      if (!eventsRes.ok || !eventsData.success) {
        setError(eventsData.error === "Target not found" ? "Account not found" : "Failed to load timeline");
        return;
      }
      setTarget(eventsData.target);
      setEvents(eventsData.events || []);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [username, router]);

  const handleToggleMonitoring = async () => {
    if (!target) return;
    track("monitoring_toggled", {
      action: target.monitoring_enabled ? "stop" : "start",
      username: target.username,
    });
    setTogglingMonitoring(true);
    try {
      if (target.monitoring_enabled) {
        // ─── STOP monitoring (user-initiated) ───
        const res = await fetch("/api/instagram/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId: target.id, action: "stop" }),
        });
        const data = await res.json();
        if (res.status === 402) {
          router.replace("/app/pricing");
          return;
        }
        if (!res.ok) {
          window.alert(data?.error || "Could not pause monitoring. Please try again.");
          return;
        }
        setTarget((prev) => prev ? { ...prev, monitoring_enabled: false } : null);
        if (data?.message) window.alert(data.message);
        return;
      }

      // ─── START tracking — confirm the current account-size scan cost ───
      if (!userEmail) return;

      const requiredCredits = scanCreditsForFollowingCount(
        target.following_count
      );
      const approved = window.confirm(
        `Automatic count checks are free. When @${target.username} needs a complete scan, it currently uses ${requiredCredits} ${requiredCredits === 1 ? "scan credit" : "scan credits"}. Approve and resume monitoring?`
      );
      if (!approved) return;

      const res = await fetch("/api/instagram/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: target.id,
          email: userEmail,
          scanCreditsConfirmed: true,
          quotedScanCredits: requiredCredits,
        }),
      });
      const data = await res.json();

      if (res.status === 402) {
        router.replace("/app/pricing");
        return;
      }

      if (!res.ok) {
        window.alert(data?.error || "Could not start tracking. Please try again.");
        return;
      }

      // Already paid → monitoring activated server-side.
      setTarget((prev) => prev ? { ...prev, monitoring_enabled: true } : null);
      if (data?.message) window.alert(data.message);
    } catch { /* ignore */ }
    finally { setTogglingMonitoring(false); }
  };

  const purchaseOneTime = async (
    kind: "export" | "export_unlimited" | "rescan_credits" | "mutuals",
    targetId?: string,
    bundleOrTier?: RescanBundle | ExportOptionTier
  ) => {
    try {
      track("upsell_checkout_started", {
        kind,
        username,
        ...(bundleOrTier ? { option: bundleOrTier } : {}),
      });
      const res = await fetch("/api/stripe/one-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          bundle:
            typeof bundleOrTier === "string" &&
            (bundleOrTier === "3" || bundleOrTier === "10" || bundleOrTier === "30")
              ? bundleOrTier
              : undefined,
          exportTier:
            typeof bundleOrTier === "string" &&
            (bundleOrTier === "single" || bundleOrTier === "unlimited")
              ? bundleOrTier
              : undefined,
          targetId: targetId || target?.id,
          username,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        window.alert(data.error || "Could not start checkout");
      }
    } catch {
      window.alert("Network error");
    }
  };

  const handleSelectBundle = async (bundle: RescanBundle, changePaymentMethod = false) => {
    setPurchasingBundle(true);
    try {
      if (!changePaymentMethod) {
        const res = await fetch("/api/stripe/one-click-charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "rescan_credits",
            bundle,
            targetId: target?.id,
            username,
          }),
        });
        const data = await res.json();
        if (data.success) {
          const bundleConfig = RESCAN_BUNDLES.find((b) => b.bundle === bundle);
          const added = bundleConfig ? bundleConfig.credits : 30;
          setCredits((c) => ({
            ...c,
            rescan_credits: c.rescan_credits + added,
            scan_purchased: c.scan_purchased + added,
          }));
          setShowRescanModal(false);
          return;
        }
      }
      await purchaseOneTime("rescan_credits", target?.id, bundle);
    } catch {
      await purchaseOneTime("rescan_credits", target?.id, bundle);
    } finally {
      setPurchasingBundle(false);
    }
  };

  const handleSelectExportOption = async (tier: ExportOptionTier, changePaymentMethod = false) => {
    setPurchasingExport(true);
    try {
      if (!changePaymentMethod) {
        const res = await fetch("/api/stripe/one-click-charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: tier === "unlimited" ? "export_unlimited" : "export",
            exportTier: tier,
            targetId: target?.id,
            username,
          }),
        });
        const data = await res.json();
        if (data.success) {
          if (tier === "unlimited") {
            setCredits((c) => ({ ...c, unlimited_export: true }));
          } else {
            setCredits((c) => ({ ...c, export: c.export + 1 }));
          }
          setShowExportModal(false);
          setTimeout(() => {
            void handleExport();
          }, 300);
          return;
        }
      }
      await purchaseOneTime("export", target?.id, tier);
    } catch {
      await purchaseOneTime("export", target?.id, tier);
    } finally {
      setPurchasingExport(false);
    }
  };

  const handleRescan = async () => {
    if (!target || rescanning) return;
    if (!target.monitoring_enabled) {
      window.alert("Tracking is paused for this account. Please resume tracking before running a rescan.");
      return;
    }
    const requiredCredits = scanCreditsForFollowingCount(
      target.following_count
    );
    track("rescan_clicked", {
      username: target.username,
      has_credit: credits.rescan_credits >= requiredCredits,
      required_credits: requiredCredits,
    });
    if (credits.rescan_credits < requiredCredits) {
      setShowRescanModal(true);
      return;
    }
    const approved = window.confirm(
      `@${target.username} follows ${target.following_count.toLocaleString()} accounts. This complete scan will use ${requiredCredits} ${requiredCredits === 1 ? "scan credit" : "scan credits"}. Continue?`
    );
    if (!approved) return;
    setRescanning(true);
    try {
      const requestId = crypto.randomUUID();
      const res = await fetch("/api/instagram/rescan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: target.id,
          requestId,
          scanCreditsConfirmed: true,
          quotedScanCredits: requiredCredits,
        }),
      });
      const data = await res.json();
      if (res.status === 402 && data.needsPurchase) {
        setShowRescanModal(true);
        return;
      }
      if (!res.ok) {
        if (data.quote?.followingCount) {
          setTarget((current) =>
            current
              ? { ...current, following_count: data.quote.followingCount }
              : current
          );
        }
        window.alert(data.error || "Rescan failed");
        return;
      }
      if (data.credits) {
        setCredits((c) => ({
          ...c,
          rescan_credits: data.credits.purchased,
          scan_included: data.credits.included,
          scan_purchased: data.credits.purchased,
          scan_weekly_allowance: data.credits.weeklyAllowance,
          scan_refresh_at: data.credits.refreshAt,
        }));
      }
      track("rescan_completed", { username: target.username });
      await loadData();
    } catch {
      window.alert("Network error");
    } finally {
      setRescanning(false);
    }
  };

  const hasExportAccess = Boolean(credits.unlimited_export || credits.export > 0);
  const requiredScanCredits = target
    ? scanCreditsForFollowingCount(target.following_count)
    : 1;

  const handleExport = async () => {
    if (!target || exporting) return;
    track("export_clicked", {
      username: target.username,
      has_credit: hasExportAccess,
    });
    if (!hasExportAccess) {
      setShowExportModal(true);
      return;
    }
    setExporting(true);
    try {
      const res = await fetch(
        `/api/instagram/export?targetId=${encodeURIComponent(target.id)}`
      );
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        if (data.needsPurchase) {
          setShowExportModal(true);
          return;
        }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `checkfollows-${target.username}-history.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (!credits.unlimited_export) {
        setCredits((c) => ({ ...c, export: Math.max(0, c.export - 1) }));
      }
      track("export_completed", { username: target.username });
    } catch {
      window.alert("Network error");
    } finally {
      setExporting(false);
    }
  };

  const handleMutuals = async () => {
    const other = mutualUsername.replace(/^@/, "").trim();
    if (!target || !other || mutualLoading) return;
    track("mutuals_clicked", {
      username: target.username,
      other,
      has_credit: credits.mutuals > 0,
    });
    if (credits.mutuals <= 0) {
      const confirmBuy = window.confirm(
        `Mutual Follows Report is a $4.99 add-on. Purchase now to compare @${target.username} and @${other}?`
      );
      if (!confirmBuy) return;

      setMutualLoading(true);
      try {
        const chargeRes = await fetch("/api/stripe/one-click-charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "mutuals",
            targetId: target.id,
            username: target.username,
          }),
        });
        const chargeData = await chargeRes.json();
        if (chargeData.success) {
          setCredits((c) => ({ ...c, mutuals: c.mutuals + 1 }));
        } else {
          await purchaseOneTime("mutuals", target.id);
          return;
        }
      } catch {
        await purchaseOneTime("mutuals", target.id);
        return;
      } finally {
        setMutualLoading(false);
      }
    }
    setMutualLoading(true);
    setMutualError("");
    setMutualResult(null);
    try {
      const res = await fetch("/api/instagram/mutuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: target.id,
          username: other,
        }),
      });
      const data = await res.json();
      if (res.status === 402 && data.needsPurchase) {
        await purchaseOneTime("mutuals", target.id);
        return;
      }
      if (!res.ok) {
        setMutualError(data.error || "Failed to calculate mutual follows");
        return;
      }
      setCredits((c) => ({
        ...c,
        mutuals: Math.max(0, c.mutuals - 1),
      }));
      setMutualResult(data);
      track("mutuals_completed", {
        username: target.username,
      });
    } catch {
      setMutualError("Network error");
    } finally {
      setMutualLoading(false);
    }
  };

  // ─── Post-payment success handling ───
  // Stripe redirects here with ?session_id=...&success=true. We verify the
  // session, then route a selected target through scan-credit confirmation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const success = params.get("success");

    if (!sessionId || success !== "true") return;

    (async () => {
      try {
        const res = await fetch("/api/stripe/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (data?.success) {
          if (data.needsScanConfirmation && data.targetId && data.username) {
            router.replace(
              `/app/add-account?username=${encodeURIComponent(data.username)}&targetId=${encodeURIComponent(data.targetId)}&postPurchase=1`
            );
            return;
          }
          window.alert("Payment confirmed. Review the account's scan cost before monitoring begins.");
          // Reload to show the latest monitoring state + events.
          await loadData();
        }
      } catch { /* ignore */ }
      finally {
        // Clean the query params so refresh doesn't re-activate.
        const url = new URL(window.location.href);
        url.searchParams.delete("session_id");
        url.searchParams.delete("success");
        window.history.replaceState({}, "", url.toString());
      }
    })();
  }, [loadData, router]);

  // ─── One-time purchase success handling ───
  // Stripe returns here with ?purchase=...&success=true. Poll /api/account a
  // few times so the freshly-credited balance shows up (webhook timing).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    if (params.get("success") !== "true" || !purchase) return;

    let cancelled = false;
    (async () => {
      for (let i = 0; i < 4; i++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/account");
          const data = await res.json();
          if (data?.credits) {
            setCredits(data.credits);
            break;
          }
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("purchase");
      url.searchParams.delete("success");
      window.history.replaceState({}, "", url.toString());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = activeTab === "all"
    ? events
    : events.filter((e) => {
        if (activeTab === "following") return e.event_type.includes("FOLLOWING");
        if (activeTab === "followers") return e.event_type.includes("FOLLOWER");
        return true;
      });

  const confirmedEvents = filteredEvents.filter((e) => e.confirmed);
  const unconfirmedEvents = filteredEvents.filter((e) => !e.confirmed);
  const newFollows = events.filter((e) => e.event_type === "NEW_FOLLOWING" && e.confirmed).length;
  const unfollows = events.filter((e) => e.event_type === "STOPPED_FOLLOWING" && e.confirmed).length;
  const newFollowers = events.filter((e) => e.event_type === "NEW_FOLLOWER" && e.confirmed).length;
  const lostFollowers = events.filter((e) => e.event_type === "LOST_FOLLOWER" && e.confirmed).length;

  // Loading / auth-gate state
  if (loading) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6 sm:py-10 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-[var(--badge-bg)] shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 rounded-xl bg-[var(--badge-bg)]" />
              <div className="h-4 w-32 rounded-lg bg-[var(--badge-bg)]/80" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4" />
            ))}
          </div>
          <div className="h-64 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4" />
        </main>
      </AppShell>
    );
  }

  // Error state
  if (error || !target) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <Card variant="subtle" className="text-center max-w-sm border-rose-500/30">
          <p className="text-rose-600 dark:text-rose-400 text-sm font-medium mb-4">{error || "Account not found"}</p>
          <Link href="/dashboard">
            <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to tracked accounts
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <AppShell
      maxWidth="max-w-6xl"
      actions={
        <a
          href={`https://instagram.com/${target.username}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track("instagram_link_clicked", { username: target.username })
          }
          className="hidden items-center gap-1.5 text-xs font-semibold text-[#555555] transition-colors hover:text-[#121212] sm:flex"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Instagram
        </a>
      }
    >

      {/* ── Profile Hero ── */}
      <section className="border-b border-[#E2E2DC] bg-[#F9F9F7] ramp-grid-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-5"
          >
            <Avatar
              src={target.avatar_url}
              username={target.username}
              isVerified={target.is_verified}
              size="xl"
              limeHalo
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121212]">
                  @{target.username}
                </h1>
                {target.is_verified && (
                  <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-500 stroke-white" />
                )}
              </div>
              {target.full_name &&
              target.full_name.replace(/^@/, "").toLowerCase() !==
                target.username.toLowerCase() ? (
                <p className="font-medium text-[#555555]">{target.full_name}</p>
              ) : null}
              <div className="flex items-center gap-5 mt-2.5 text-sm">
                <span>
                  <strong className="text-[#121212]">{target.following_count.toLocaleString()}</strong>{" "}
                  <span className="text-[#555555]">following</span>
                </span>
                <span>
                  <strong className="text-[#121212]">{target.follower_count.toLocaleString()}</strong>{" "}
                  <span className="text-[#555555]">followers</span>
                </span>
              </div>
            </div>

            {/* Monitoring toggle */}
            <Button
              variant={target.monitoring_enabled ? "secondary" : "primary"}
              size="md"
              leftIcon={
                target.monitoring_enabled
                  ? <BellOff className="w-4 h-4" />
                  : <Bell className="w-4 h-4" />
              }
              onClick={handleToggleMonitoring}
              isLoading={togglingMonitoring}
            >
              {target.monitoring_enabled ? "Stop Monitoring" : "Track Changes"}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── Freshness Bar ── */}
      <section className="border-b border-[#E2E2DC] bg-[#FFFFFF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 text-[#555555] font-semibold">
            <div className={`w-2 h-2 rounded-full ${target.last_scanned_at ? "bg-emerald-500" : "bg-[#E2E2DC]"}`} />
            <span>
              Last full scan:{" "}
              <strong className="text-[#121212]">
                {formatRelativeTime(target.last_scanned_at)}
              </strong>
            </span>
          </div>
          {target.monitoring_enabled && (
            <>
              <span className="text-[#E2E2DC]">·</span>
              <div className="flex items-center gap-1.5 text-[#555555] font-semibold">
                <RefreshCw className="w-3 h-3" />
                <span>
                  Next check:{" "}
                  <strong className="text-[#121212]">
                    {formatNextCheck(target.next_scan_at)}
                  </strong>
                </span>
              </div>
              <span className="text-[#E2E2DC]">·</span>
              <Badge variant="lime" size="sm">Monitoring Active</Badge>
            </>
          )}
          {events.length === 0 && target.last_scanned_at && (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold ml-auto">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Checked today — no changes detected
            </div>
          )}
        </div>
      </section>

      {/* ─── Add-ons (upsells) ─── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Card padding="lg">
          <h2 className="text-base font-extrabold text-[#121212]">Add-ons</h2>
          <p className="text-xs text-[#555555] mt-0.5 mb-5">
            One-time tools for this account.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Rescan now */}
            <div className="rounded-xl border border-[#E2E2DC] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <RefreshCw className="w-5 h-5 text-[#121212]" />
                  {!target.monitoring_enabled ? (
                    <Badge variant="mono" size="sm">
                      Paused
                    </Badge>
                  ) : credits.rescan_credits >= requiredScanCredits ? (
                    <Badge variant="lime" size="sm">
                      {credits.rescan_credits} {credits.rescan_credits === 1 ? "credit" : "credits"}
                    </Badge>
                  ) : null}
                </div>
                <h3 className="text-sm font-extrabold text-[#121212]">Rescan now</h3>
                <p className="text-xs text-[#555555] mt-1">
                  {!target.monitoring_enabled
                    ? "Tracking is currently paused. Resume to run on-demand rescans."
                    : `A complete scan uses ${requiredScanCredits} ${requiredScanCredits === 1 ? "credit" : "credits"} at this account's current size.`}
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {!target.monitoring_enabled ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleToggleMonitoring}
                    isLoading={togglingMonitoring}
                    fullWidth
                  >
                    Resume tracking
                  </Button>
                ) : (
                  <>
                    <Button
                      variant={credits.rescan_credits >= requiredScanCredits ? "primary" : "secondary"}
                      size="sm"
                      onClick={credits.rescan_credits >= requiredScanCredits ? handleRescan : () => setShowRescanModal(true)}
                      isLoading={rescanning}
                      fullWidth
                    >
                      {credits.rescan_credits >= requiredScanCredits
                        ? `Rescan now · Uses ${requiredScanCredits}`
                        : "Add scan credits"}
                    </Button>
                    {credits.rescan_credits >= requiredScanCredits && (
                      <button
                        type="button"
                        onClick={() => setShowRescanModal(true)}
                        className="w-full text-center text-[11px] font-bold text-[#555555] hover:text-[#121212] transition-colors py-0.5"
                      >
                        + Buy more scan credits
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Export timeline */}
            <div className="rounded-xl border border-[#E2E2DC] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Download className="w-5 h-5 text-[#121212]" />
                  {credits.unlimited_export ? (
                    <Badge variant="lime" size="sm">
                      Unlimited Pass
                    </Badge>
                  ) : credits.export > 0 ? (
                    <Badge variant="lime" size="sm">
                      {credits.export} available
                    </Badge>
                  ) : null}
                </div>
                <h3 className="text-sm font-extrabold text-[#121212]">Export timeline</h3>
                <p className="text-xs text-[#555555] mt-1">
                  Download the full follow/unfollow history as a CSV spreadsheet.
                </p>
              </div>

              <div className="mt-3 space-y-2">
                <Button
                  variant={hasExportAccess ? "primary" : "secondary"}
                  size="sm"
                  onClick={hasExportAccess ? handleExport : () => setShowExportModal(true)}
                  isLoading={exporting}
                  fullWidth
                >
                  {credits.unlimited_export
                    ? "Download CSV (Unlimited)"
                    : credits.export > 0
                    ? `Export CSV (${credits.export} left)`
                    : "Export CSV"}
                </Button>
                {!credits.unlimited_export && (
                  <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    className="w-full text-center text-[11px] font-bold text-[#555555] hover:text-[#121212] transition-colors py-0.5"
                  >
                    {credits.export > 0 ? "+ Upgrade to Unlimited Pass ($9.99)" : "From $4.99 · Unlimited pass $9.99"}
                  </button>
                )}
              </div>
            </div>

            {/* Mutual follows */}
            <div className="rounded-xl border border-[#E2E2DC] p-4 flex flex-col">
              <Users className="w-5 h-5 text-[#121212] mb-2" />
              <h3 className="text-sm font-extrabold text-[#121212]">Mutual follows</h3>
              <p className="text-xs text-[#555555] mt-1 flex-1">
                See who they follow in common with another account.
              </p>
              <div className="flex gap-2 mt-3">
                <input
                  value={mutualUsername}
                  onChange={(e) => setMutualUsername(e.target.value)}
                  placeholder="@username"
                  className="min-w-0 flex-1 rounded-lg border border-[#E2E2DC] bg-white px-3 py-2 text-base font-medium text-[#121212] placeholder:text-[#999999] outline-none focus:border-[#121212]"
                />
                <Button
                  variant={credits.mutuals > 0 ? "primary" : "secondary"}
                  size="sm"
                  onClick={handleMutuals}
                  isLoading={mutualLoading}
                >
                  Go
                </Button>
              </div>
            </div>
          </div>

          {mutualResult && (
            <div className="mt-4 rounded-xl bg-[#F9F9F7] border border-[#E2E2DC] p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-extrabold text-[#121212]">
                  @{target.username} and @{mutualResult.otherUsername}
                </h4>
                <Badge variant="lime" size="sm">
                  {mutualResult.mutualCount} mutual
                </Badge>
              </div>
              {mutualResult.mutuals.length === 0 ? (
                <p className="text-sm text-[#555555]">No mutual follows found.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {mutualResult.mutuals.map((m) => (
                    <span
                      key={m.userId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E2DC] bg-white px-3 py-1 text-xs font-bold text-[#121212]"
                    >
                      @{m.username}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {mutualError && (
            <p className="mt-2 text-xs font-semibold text-[#B91C1C]">{mutualError}</p>
          )}
        </Card>
      </section>

      {/* ─── Timeline ─── */}
      <section className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">
        {/* Header + tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-[#121212]">Activity Timeline</h2>
            <p className="text-xs text-[#555555] mt-0.5">
              {events.length} total events · {confirmedEvents.length} confirmed · {unconfirmedEvents.length} pending
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mb-6">
          <Tabs
            activeTab={activeTab}
            onChange={(id) => {
              setActiveTab(id);
              track("timeline_filter_changed", { tab: id, username });
            }}
            tabs={[
              { id: "all", label: "All", badge: events.length },
              {
                id: "following",
                label: "Following",
                badge: events.filter((e) => e.event_type.includes("FOLLOWING")).length,
              },
              {
                id: "followers",
                label: "Followers",
                badge: events.filter((e) => e.event_type.includes("FOLLOWER")).length,
              },
            ]}
          />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="New Follows"
            value={newFollows}
            icon={<UserPlus className="w-4 h-4" />}
            changeType="positive"
          />
          <StatCard
            label="Unfollows"
            value={unfollows}
            icon={<UserMinus className="w-4 h-4" />}
            changeType={unfollows > 0 ? "negative" : "neutral"}
          />
          <StatCard
            label="New Followers"
            value={newFollowers}
            icon={<TrendingUp className="w-4 h-4" />}
            changeType="positive"
          />
          <StatCard
            label="Lost Followers"
            value={lostFollowers}
            icon={<TrendingUp className="w-4 h-4 rotate-180" />}
            changeType={lostFollowers > 0 ? "negative" : "neutral"}
          />
        </div>

        {/* Event list */}
        {filteredEvents.length === 0 ? (
          <Card variant="subtle" className="text-center py-12">
            <Calendar className="w-10 h-10 text-[#555555] mx-auto mb-3" />
            <h3 className="font-bold text-[#121212] mb-1">No changes detected yet</h3>
            <p className="text-sm text-[#555555] max-w-sm mx-auto">
              {events.length === 0
                ? "We've established a baseline. Changes will appear here after the next scan — check back tomorrow."
                : "No events match the current filter."}
            </p>
          </Card>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-[#E2E2DC]" />

            <div className="space-y-1">
              {filteredEvents.map((event, idx) => {
                const isAddition =
                  event.event_type === "NEW_FOLLOWING" || event.event_type === "NEW_FOLLOWER";

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="relative pl-12 py-3"
                  >
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-[14px] top-4 w-3 h-3 rounded-full border-2 border-[#FFFFFF] shadow-sm ${
                        event.confirmed
                          ? isAddition ? "bg-emerald-500" : "bg-rose-500"
                          : "bg-[#E2E2DC] border-dashed"
                      }`}
                    />

                    <Card
                      hoverable
                      className={`bg-[#FFFFFF] ${!event.confirmed ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 p-2 rounded-xl bg-[#F9F9F7] border border-[#E2E2DC]">
                          {eventIcon(event.event_type, "sm")}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Avatar
                            src={event.avatar_url}
                            username={event.username}
                            isVerified={event.is_verified}
                            size="md"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-[#121212] truncate">
                                @{event.username}
                              </span>
                              {event.full_name && (
                                <span className="text-xs text-[#555555]">{event.full_name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-[#555555]">
                                {eventLabel(event.event_type)}
                              </span>
                              <span className="text-[#E2E2DC] text-[10px]">·</span>
                              <span className="text-xs text-[#777777]">
                                {formatRelativeTime(event.detected_at)}
                              </span>
                            </div>
                          </div>
                          {!event.confirmed && (
                            <Badge variant="mono" size="sm" className="shrink-0">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-4 sm:px-6 bg-[#FFFFFF] border-t border-[#E2E2DC]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 text-[10px] text-[#777777] font-medium">
            <Link href="/dashboard" className="hover:text-[#121212] transition-colors">Dashboard</Link>
            <span>·</span>
            <Link href="/account" className="hover:text-[#121212] transition-colors">Account</Link>
          </div>
        </div>
      </footer>
      {/* ── Rescan Bundle Modal ── */}
      <RescanBundleModal
        open={showRescanModal}
        onClose={() => setShowRescanModal(false)}
        username={target?.username || username}
        requiredCredits={requiredScanCredits}
        currentBalance={credits.rescan_credits}
        onSelectBundle={handleSelectBundle}
        loading={purchasingBundle}
      />
      {/* ── Export Modal ── */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        username={target?.username || username}
        onSelectOption={handleSelectExportOption}
        loading={purchasingExport}
      />
    </AppShell>
  );
}
