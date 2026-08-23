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
        "id, instagram_id, username, full_name, avatar_url, is_verified, following_count, follower_count, last_scanned_at, next_scan_at, monitoring_enabled, monitoring_interval_hours"
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
  const [timeline, credits] = await Promise.all([
    getTrackingTimelineForTarget(target),
    getCreditsSummary(user.id),
  ]);

  return (
    <TrackPageClient
      username={username}
      userEmail={user.email || ""}
      initialTarget={{
        ...timeline.target,
        monitoring_enabled:
          timeline.target.monitoring_enabled && ownershipRow.user_paused !== true,
      }}
      initialEvents={timeline.events}
      initialCredits={credits}
    />
  );
}
