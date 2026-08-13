"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Zap,
  UserPlus,
  UserMinus,
  TrendingUp,
  ExternalLink,
  Calendar,
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button, Badge, Card, Avatar, Tabs, StatCard } from "@/design-system";

// ─── Types ──────────────────────────────────────────────────

interface TrackedEvent {
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

interface TargetProfile {
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

function groupEventsByDay(events: TrackedEvent[]): Map<string, TrackedEvent[]> {
  const map = new Map<string, TrackedEvent[]>();
  for (const e of events) {
    const day = formatRelativeTime(e.detected_at);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return map;
}

// ─── Page ───────────────────────────────────────────────────

export default function TrackPage() {
  const params = useParams();
  const router = useRouter();
  const username = (params.username as string || "").replace(/^@/, "");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TargetProfile | null>(null);
  const [events, setEvents] = useState<TrackedEvent[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [togglingMonitoring, setTogglingMonitoring] = useState(false);

  const loadData = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const [profileRes, eventsRes] = await Promise.all([
        fetch(`/api/instagram/profile?username=${encodeURIComponent(username)}`),
        fetch(`/api/instagram/events?username=${encodeURIComponent(username)}`),
      ]);
      const [profileData, eventsData] = await Promise.all([
        profileRes.json(),
        eventsRes.json(),
      ]);

      if (!profileData.success) {
        setError(profileData.error === "not_found" ? "Account not found" : "Failed to load profile");
        setLoading(false);
        return;
      }

      // Also fetch target metadata from Supabase for monitoring status
      const targetRes = await fetch(`/api/instagram/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, stage: "preview" }),
      });
      const targetData = await targetRes.json().catch(() => ({}));

      setTarget({
        id: profileData.profile.id || targetData.target?.id || "",
        instagram_id: profileData.profile.instagramId,
        username: profileData.profile.username,
        full_name: profileData.profile.fullName,
        avatar_url: profileData.profile.avatarUrl,
        is_verified: profileData.profile.isVerified,
        following_count: profileData.profile.followingCount ?? profileData.profile.following_count ?? 0,
        follower_count: profileData.profile.followerCount ?? profileData.profile.follower_count ?? 0,
        last_scanned_at: targetData.target?.last_scanned_at || null,
        next_scan_at: targetData.target?.next_scan_at || null,
        monitoring_enabled: targetData.target?.monitoring_enabled ?? false,
        monitoring_interval_hours: targetData.target?.monitoring_interval_hours ?? 24,
      });

      if (eventsData.success && eventsData.events) {
        setEvents(eventsData.events);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      if (!ignore) {
        await loadData();
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [loadData]);

  const handleToggleMonitoring = async () => {
    if (!target) return;
    setTogglingMonitoring(true);
    try {
      const email = window.prompt(
        target.monitoring_enabled
          ? "Enter your email to confirm stopping monitoring:"
          : "Enter your email to start monitoring this account:"
      );
      if (!email) return;

      await fetch("/api/instagram/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: target.id, email }),
      });
      setTarget((prev) => prev ? { ...prev, monitoring_enabled: !prev.monitoring_enabled } : null);
    } catch { /* ignore */ }
    finally { setTogglingMonitoring(false); }
  };

  const filteredEvents = activeTab === "all"
    ? events
    : events.filter((e) => {
        if (activeTab === "following") return e.event_type.includes("FOLLOWING");
        if (activeTab === "followers") return e.event_type.includes("FOLLOWER");
        return true;
      });

  const confirmedEvents = filteredEvents.filter((e) => e.confirmed);
  const unconfirmedEvents = filteredEvents.filter((e) => !e.confirmed);
  const groupedEvents = groupEventsByDay(filteredEvents);

  const newFollows = events.filter((e) => e.event_type === "NEW_FOLLOWING" && e.confirmed).length;
  const unfollows = events.filter((e) => e.event_type === "STOPPED_FOLLOWING" && e.confirmed).length;
  const newFollowers = events.filter((e) => e.event_type === "NEW_FOLLOWER" && e.confirmed).length;
  const lostFollowers = events.filter((e) => e.event_type === "LOST_FOLLOWER" && e.confirmed).length;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-3 border-[#121212] border-t-[#E7F256] animate-spin" />
          <p className="text-[#555555] text-sm font-semibold">Loading timeline...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !target) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
        <Card variant="subtle" className="text-center max-w-sm border-[#FCA5A5]">
          <p className="text-[#B91C1C] text-sm font-medium mb-4">{error || "Account not found"}</p>
          <Link href="/">
            <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to search
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* ── Glass Header ── */}
      <nav className="sticky top-0 z-50 ramp-glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-[#555555] hover:text-[#121212] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2.5 font-bold text-lg text-[#121212] hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-[#121212] flex items-center justify-center text-[#E7F256]">
                <Zap className="w-4 h-4 fill-current text-[#E7F256]" />
              </div>
              <span className="tracking-tight text-xl font-extrabold">CheckFollows</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`https://instagram.com/${target.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] hover:text-[#121212] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on Instagram
            </a>
          </div>
        </div>
      </nav>

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
                  {target.full_name || `@${target.username}`}
                </h1>
                {target.is_verified && (
                  <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-500 stroke-white" />
                )}
              </div>
              <p className="text-[#555555] font-medium">@{target.username}</p>
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
              Last checked:{" "}
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
            onChange={setActiveTab}
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
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-[#121212] mb-2">
            <div className="w-5 h-5 rounded-full bg-[#121212] flex items-center justify-center text-[#E7F256]">
              <Zap className="w-3 h-3 fill-current text-[#E7F256]" />
            </div>
            <span>CheckFollows</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-[10px] text-[#777777] font-medium">
            <Link href="/" className="hover:text-[#121212] transition-colors">Home</Link>
            <span>·</span>
            <a href="#" className="hover:text-[#121212] transition-colors">Privacy</a>
            <span>·</span>
            <a href="#" className="hover:text-[#121212] transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
