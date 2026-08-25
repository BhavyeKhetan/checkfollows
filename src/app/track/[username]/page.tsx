import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import TrackPageClient from "./track-page-client";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import { getCreditsSummary } from "@/lib/purchases";
import {
  getTrackingTimelineForTarget,
  type TrackingTarget,
} from "@/lib/tracking-data";
import { createServerClient } from "@/lib/supabase/server";
import { getPrivateScanResult } from "@/app/api/private-scan/[jobId]/route";
import type { TrackedEvent } from "./track-page-client";
import type { PrivateScanResult } from "@/lib/private-scan/contracts";

export const metadata: Metadata = {
  title: "Private tracking dashboard | CheckFollows",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default async function TrackPage({
  params,
}: PageProps<"/track/[username]">) {
  const { username: rawUsername } = await params;
  const username = rawUsername.replace(/^@/, "").trim().toLowerCase();

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) notFound();

  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/track/${username}`)}`);
  }

  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
  const supabase = createServerClient();
  const [active, targetResult] = await Promise.all([
    hasActiveSubscription(user.id),
    supabase
      .from("instagram_targets")
      .select(
        "id, instagram_id, username, full_name, avatar_url, is_private, is_verified, following_count, follower_count, last_scanned_at, next_scan_at, monitoring_enabled, monitoring_interval_hours"
      )
      .eq("username", cleanUsername)
      .maybeSingle(),
  ]);
  if (!active) {
    redirect(
      `/account?renew=1&returnTo=${encodeURIComponent(`/track/${username}`)}`
    );
  }

  const target = targetResult.data as TrackingTarget | null;
  if (!target) notFound();

  const ownership = await supabase
    .from("subscriptions")
    .select("user_paused, id")
    .eq("user_id", user.id)
    .eq("target_id", target.id)
    .maybeSingle();

  let ownershipRow = ownership.data;
  if (!ownershipRow && user.email) {
    const fallback = await supabase
      .from("subscriptions")
      .select("user_paused, id")
      .eq("email", user.email)
      .eq("target_id", target.id)
      .maybeSingle();
    ownershipRow = fallback.data;
  }
  if (!ownershipRow) notFound();

  // Fetch private timeline data only after the ownership check passes.
  const targetIsPrivate = target.is_private === true;

  const [credits] = await Promise.all([
    getCreditsSummary(user.id),
  ]);

  let timeline: { target: TrackingTarget; events: TrackedEvent[] } | null = null;
  let privateScanResult: PrivateScanResult | null = null;
  let privateEvents: TrackedEvent[] = [];

  if (targetIsPrivate) {
    // Private target: fetch from private scan tables
    const [scanResult, eventsResult] = await Promise.all([
      getPrivateScanResult(user.id, target.id),
      supabase
        .from("private_follow_events")
        .select(
          "id, event_type, instagram_id, username, full_name, avatar_url, is_verified, detected_at, confirmed"
        )
        .eq("user_id", user.id)
        .eq("target_id", target.id)
        .order("detected_at", { ascending: false })
        .limit(200),
    ]);
    privateScanResult = scanResult;
    privateEvents = (eventsResult.data || []) as TrackedEvent[];
    timeline = {
      target: {
        ...target,
        monitoring_enabled: false, // private targets never auto-monitor
      },
      events: [],
    };
  } else {
    timeline = await getTrackingTimelineForTarget(target);
  }

  return (
    <TrackPageClient
      username={username}
      userEmail={user.email || ""}
      initialTarget={{
        ...(timeline?.target ?? target),
        monitoring_enabled: !targetIsPrivate
          ? (timeline?.target.monitoring_enabled && ownershipRow.user_paused !== true)
          : false,
      }}
      initialEvents={timeline?.events ?? []}
      initialCredits={credits}
      isPrivate={targetIsPrivate}
      privateScanData={privateScanResult}
      initialPrivateEvents={privateEvents}
    />
  );
}
