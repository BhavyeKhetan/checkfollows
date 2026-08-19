import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import TrackPageClient from "./track-page-client";
import {
  getAuthUser,
  hasActiveSubscription,
  ownsTarget,
} from "@/lib/supabase/auth";
import { getCreditsSummary } from "@/lib/purchases";
import { getTrackingTimeline } from "@/lib/tracking-data";
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

  const active = await hasActiveSubscription(user.id);
  if (!active) {
    redirect(
      `/account?renew=1&returnTo=${encodeURIComponent(`/track/${username}`)}`
    );
  }

  const supabase = createServerClient();
  const { data: target } = await supabase
    .from("instagram_targets")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (!target || !(await ownsTarget(user.id, target.id, user.email))) notFound();

  const [timeline, credits, ownership] = await Promise.all([
    getTrackingTimeline(username),
    getCreditsSummary(user.id),
    supabase
      .from("subscriptions")
      .select("user_paused")
      .eq("user_id", user.id)
      .eq("target_id", target.id)
      .maybeSingle(),
  ]);

  if (!timeline) notFound();

  return (
    <TrackPageClient
      username={username}
      userEmail={user.email || ""}
      initialTarget={{
        ...timeline.target,
        monitoring_enabled:
          timeline.target.monitoring_enabled && ownership.data?.user_paused !== true,
      }}
      initialEvents={timeline.events}
      initialCredits={credits}
    />
  );
}
