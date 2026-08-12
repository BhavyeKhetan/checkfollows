/**
 * Email alert system for CheckFollows.
 * Sends notifications when new follow events are confirmed.
 */

import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "alerts@checkfollows.com";

export interface AlertPayload {
  targetUsername: string;
  targetFullName: string | null;
  subscriberEmail: string;
  events: Array<{
    eventType: "NEW_FOLLOWING" | "STOPPED_FOLLOWING" | "NEW_FOLLOWER" | "LOST_FOLLOWER";
    username: string;
    fullName: string | null;
  }>;
}

export async function sendAlertEmail(payload: AlertPayload): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log("[Alerts] Resend not configured, skipping email to", payload.subscriberEmail);
    return false;
  }

  const targetName = payload.targetFullName || `@${payload.targetUsername}`;
  const newFollows = payload.events.filter((e) => e.eventType === "NEW_FOLLOWING");
  const unfollows = payload.events.filter((e) => e.eventType === "STOPPED_FOLLOWING");
  const newFollowers = payload.events.filter((e) => e.eventType === "NEW_FOLLOWER");
  const lostFollowers = payload.events.filter((e) => e.eventType === "LOST_FOLLOWER");

  const lines: string[] = [];
  if (newFollows.length > 0) {
    lines.push(`🆕 **New Follows (${newFollows.length})**`);
    newFollows.forEach((e) => lines.push(`• @${e.username}${e.fullName ? ` (${e.fullName})` : ""}`));
  }
  if (unfollows.length > 0) {
    lines.push(`\n👋 **Unfollows (${unfollows.length})**`);
    unfollows.forEach((e) => lines.push(`• @${e.username}${e.fullName ? ` (${e.fullName})` : ""}`));
  }
  if (newFollowers.length > 0) {
    lines.push(`\n➕ **New Followers (${newFollowers.length})**`);
    newFollowers.forEach((e) => lines.push(`• @${e.username}${e.fullName ? ` (${e.fullName})` : ""}`));
  }
  if (lostFollowers.length > 0) {
    lines.push(`\n➖ **Lost Followers (${lostFollowers.length})**`);
    lostFollowers.forEach((e) => lines.push(`• @${e.username}${e.fullName ? ` (${e.fullName})` : ""}`));
  }

  const totalChanges = payload.events.length;
  const subject = `${totalChanges} change${totalChanges !== 1 ? "s" : ""} detected for ${targetName}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: payload.subscriberEmail,
      subject,
      text: `CheckFollows detected ${totalChanges} change${totalChanges !== 1 ? "s" : ""} for ${targetName} (@${payload.targetUsername}):\n\n${lines.join("\n")}\n\nView full timeline: https://checkfollows.com/track/${payload.targetUsername}`,
    });
    console.log(`[Alerts] Email sent to ${payload.subscriberEmail} for @${payload.targetUsername} (${totalChanges} events)`);
    return true;
  } catch (err) {
    console.error("[Alerts] Failed to send email:", err);
    return false;
  }
}

/**
 * Send alerts to all active subscribers of a target when new confirmed events are detected.
 * Called from the cron monitor after scanning.
 */
export async function notifySubscribers(
  targetId: string,
  targetUsername: string,
  targetFullName: string | null,
  confirmedEvents: Array<{
    eventType: "NEW_FOLLOWING" | "STOPPED_FOLLOWING" | "NEW_FOLLOWER" | "LOST_FOLLOWER";
    username: string;
    fullName: string | null;
  }>
): Promise<number> {
  if (confirmedEvents.length === 0) return 0;

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data: subscribers } = await supabase
    .from("subscriptions")
    .select("email")
    .eq("target_id", targetId)
    .eq("active", true);

  if (!subscribers || subscribers.length === 0) return 0;

  let sent = 0;
  for (const sub of subscribers) {
    if (!sub.email) continue;
    const ok = await sendAlertEmail({
      targetUsername,
      targetFullName,
      subscriberEmail: sub.email,
      events: confirmedEvents,
    });
    if (ok) sent++;
  }

  return sent;
}
