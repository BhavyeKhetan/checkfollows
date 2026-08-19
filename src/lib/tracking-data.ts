import "server-only";

import { createServerClient } from "@/lib/supabase/server";

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

export interface TrackingTarget {
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

export interface TrackingTimeline {
  target: TrackingTarget;
  events: TrackedEvent[];
}

export async function getTrackingTimeline(
  username: string,
  limit = 50
): Promise<TrackingTimeline | null> {
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
  const supabase = createServerClient();

  const { data: target, error: targetError } = await supabase
    .from("instagram_targets")
    .select(
      "id, instagram_id, username, full_name, avatar_url, is_verified, following_count, follower_count, last_scanned_at, next_scan_at, monitoring_enabled, monitoring_interval_hours"
    )
    .eq("username", cleanUsername)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) return null;

  const { data: events, error: eventsError } = await supabase
    .from("follow_events")
    .select(
      "id, event_type, instagram_id, username, full_name, avatar_url, is_verified, detected_at, confirmed"
    )
    .eq("target_id", target.id)
    .eq("confirmed", true)
    .order("detected_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (eventsError) throw eventsError;

  return {
    target: target as TrackingTarget,
    events: (events || []) as TrackedEvent[],
  };
}
