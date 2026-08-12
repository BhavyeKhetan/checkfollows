"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Zap,
  UserPlus,
  UserMinus,
  Clock,
  ExternalLink,
  Calendar,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Button, Badge, Card, Avatar, Tabs } from "@/design-system";

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
  is_private: boolean;
  is_verified: boolean;
  following_count: number;
  follower_count: number;
  last_scanned_at: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function eventIcon(type: string) {
  switch (type) {
    case "NEW_FOLLOWING":
      return <UserPlus className="w-4 h-4 text-emerald-500" />;
    case "STOPPED_FOLLOWING":
      return <UserMinus className="w-4 h-4 text-red-500" />;
    case "NEW_FOLLOWER":
      return <TrendingUp className="w-4 h-4 text-blue-500" />;
    case "LOST_FOLLOWER":
      return <TrendingUp className="w-4 h-4 text-orange-500 rotate-180" />;
    default:
      return <Clock className="w-4 h-4 text-[#555555]" />;
  }
}

function eventLabel(type: string) {
  switch (type) {
    case "NEW_FOLLOWING":
      return "Started following";
    case "STOPPED_FOLLOWING":
      return "Stopped following";
    case "NEW_FOLLOWER":
      return "New follower";
    case "LOST_FOLLOWER":
      return "Lost follower";
    default:
      return type;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Page ───────────────────────────────────────────────────

export default function TrackPage() {
  const params = useParams();
  const username = (params.username as string || "").replace(/^@/, "");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TargetProfile | null>(null);
  const [events, setEvents] = useState<TrackedEvent[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;

    async function load() {
      setLoading(true);
      try {
        // Load target profile
        const profileRes = await fetch(`/api/instagram/profile?username=${encodeURIComponent(username)}`);
        const profileData = await profileRes.json();

        if (!profileData.success) {
          setError(profileData.error === "not_found" ? "Account not found" : "Failed to load profile");
          setLoading(false);
          return;
        }

        setTarget({
          id: profileData.profile.id,
          instagram_id: profileData.profile.instagramId,
          username: profileData.profile.username,
          full_name: profileData.profile.fullName,
          avatar_url: profileData.profile.avatarUrl,
          is_private: false,
          is_verified: profileData.profile.isVerified,
          following_count: profileData.profile.followingCount,
          follower_count: profileData.profile.followerCount,
          last_scanned_at: null,
          created_at: new Date().toISOString(),
        });

        // Load events
        const eventsRes = await fetch(`/api/instagram/events?username=${encodeURIComponent(username)}`);
        const eventsData = await eventsRes.json();

        if (eventsData.success && eventsData.events) {
          setEvents(eventsData.events);
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [username]);

  const filteredEvents = activeTab === "all"
    ? events
    : events.filter((e) => {
        if (activeTab === "following") return e.event_type === "NEW_FOLLOWING" || e.event_type === "STOPPED_FOLLOWING";
        if (activeTab === "followers") return e.event_type === "NEW_FOLLOWER" || e.event_type === "LOST_FOLLOWER";
        return true;
      });

  const confirmedEvents = filteredEvents.filter((e) => e.confirmed);
  const unconfirmedEvents = filteredEvents.filter((e) => !e.confirmed);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#121212]" />
          <p className="text-[#555555] text-sm font-medium">Loading timeline...</p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-[#FFFFFF]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#E2E2DC] bg-[#FFFFFF]/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-[#555555] hover:text-[#121212]">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2 font-extrabold text-lg text-[#121212]">
              <div className="w-7 h-7 rounded-full bg-[#121212] flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 fill-current text-[#E7F256]" />
              </div>
              <span>CheckFollows</span>
            </Link>
          </div>
          <a
            href={`https://instagram.com/${target.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] hover:text-[#121212]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View on Instagram
          </a>
        </div>
      </header>

      {/* Profile Section */}
      <section className="border-b border-[#E2E2DC] bg-[#F9F9F7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5"
          >
            <Avatar
              src={target.avatar_url}
              username={target.username}
              isVerified={target.is_verified}
              size="xl"
              limeHalo
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121212]">
                {target.full_name || `@${target.username}`}
              </h1>
              <p className="text-[#555555] font-medium">@{target.username}</p>
              <div className="flex items-center gap-5 mt-2 text-sm">
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
          </motion.div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
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
              { id: "following", label: "Following", badge: events.filter((e) => e.event_type.includes("FOLLOWING")).length },
              { id: "followers", label: "Followers", badge: events.filter((e) => e.event_type.includes("FOLLOWER")).length },
            ]}
          />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Card className="text-center py-3">
            <p className="text-2xl font-extrabold text-emerald-600">
              {events.filter((e) => e.event_type === "NEW_FOLLOWING" && e.confirmed).length}
            </p>
            <p className="text-[10px] text-[#555555] font-semibold uppercase mt-1">New Follows</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-2xl font-extrabold text-red-500">
              {events.filter((e) => e.event_type === "STOPPED_FOLLOWING" && e.confirmed).length}
            </p>
            <p className="text-[10px] text-[#555555] font-semibold uppercase mt-1">Unfollows</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-2xl font-extrabold text-blue-600">
              {events.filter((e) => e.event_type === "NEW_FOLLOWER" && e.confirmed).length}
            </p>
            <p className="text-[10px] text-[#555555] font-semibold uppercase mt-1">New Followers</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-2xl font-extrabold text-orange-500">
              {events.filter((e) => e.event_type === "LOST_FOLLOWER" && e.confirmed).length}
            </p>
            <p className="text-[10px] text-[#555555] font-semibold uppercase mt-1">Lost Followers</p>
          </Card>
        </div>

        {/* Event Timeline */}
        {filteredEvents.length === 0 ? (
          <Card variant="subtle" className="text-center py-12">
            <Calendar className="w-10 h-10 text-[#555555] mx-auto mb-3" />
            <h3 className="font-bold text-[#121212] mb-1">No activity yet</h3>
            <p className="text-sm text-[#555555]">
              {events.length === 0
                ? "This is the first scan. We'll detect changes starting from the next scan."
                : "No events match the current filter."}
            </p>
          </Card>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-[#E2E2DC]" />

            <div className="space-y-1">
              {filteredEvents.map((event, idx) => {
                const isNew =
                  event.event_type === "NEW_FOLLOWING" || event.event_type === "NEW_FOLLOWER";

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="relative pl-12 py-3"
                  >
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-[14px] top-4 w-3 h-3 rounded-full border-2 border-[#FFFFFF] shadow-sm ${
                        event.confirmed
                          ? isNew
                            ? "bg-emerald-500"
                            : "bg-red-500"
                          : "bg-[#E2E2DC]"
                      }`}
                    />

                    <Card hoverable className={!event.confirmed ? "opacity-60" : ""}>
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">{eventIcon(event.event_type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Avatar
                              src={event.avatar_url}
                              username={event.username}
                              isVerified={event.is_verified}
                              size="sm"
                            />
                            <span className="font-bold text-sm text-[#121212]">
                              @{event.username}
                            </span>
                            {event.full_name && (
                              <span className="text-xs text-[#555555]">{event.full_name}</span>
                            )}
                          </div>
                          <p className="text-xs text-[#555555] mt-1">
                            {eventLabel(event.event_type)} · {formatDate(event.detected_at)}
                            {!event.confirmed && (
                              <Badge variant="mono" size="sm" className="ml-2">
                                Pending confirmation
                              </Badge>
                            )}
                          </p>
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
    </div>
  );
}
