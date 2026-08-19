import { notFound, redirect } from "next/navigation";
import TrackPageClient from "./track-page-client";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import { getCreditsSummary } from "@/lib/purchases";
import { getTrackingTimeline } from "@/lib/tracking-data";

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
    redirect(`/onboarding?username=${encodeURIComponent(username)}`);
  }

  const [timeline, credits] = await Promise.all([
    getTrackingTimeline(username),
    getCreditsSummary(user.id),
  ]);

  if (!timeline) notFound();

  return (
    <TrackPageClient
      username={username}
      userEmail={user.email || ""}
      initialTarget={timeline.target}
      initialEvents={timeline.events}
      initialCredits={credits}
    />
  );
}
