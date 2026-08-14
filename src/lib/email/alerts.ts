/**
 * Email alert system for CheckFollows.
 * Sends notifications when new follow events are confirmed.
 *
 * The email is styled to match the CheckFollows design system
 * (Ramp-inspired: ink #121212, lime #E7F256, light surfaces).
 */

import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "team@checkfollows.com";
const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://checkfollows.com";

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

// ─── Design tokens (mirrors src/design-system/tokens.ts) ───────────────

const INK = "#121212";
const LIME = "#E7F256";
const TEXT_SECONDARY = "#555555";
const TEXT_TERTIARY = "#777777";
const BORDER = "#E2E2DC";
const SURFACE_SUBTLE = "#F9F9F7";

interface EventStyle {
  sectionLabel: string;
  shortLabel: string;
  sign: "+" | "−";
  color: string;
  tint: string;
}

const EVENT_STYLES: Record<AlertPayload["events"][number]["eventType"], EventStyle> = {
  NEW_FOLLOWING: {
    sectionLabel: "New follows",
    shortLabel: "Followed",
    sign: "+",
    color: "#047857",
    tint: "#E6F4EA",
  },
  STOPPED_FOLLOWING: {
    sectionLabel: "Unfollows",
    shortLabel: "Unfollowed",
    sign: "−",
    color: "#B91C1C",
    tint: "#FEE2E2",
  },
  NEW_FOLLOWER: {
    sectionLabel: "New followers",
    shortLabel: "Follower",
    sign: "+",
    color: "#0369A1",
    tint: "#E0F2FE",
  },
  LOST_FOLLOWER: {
    sectionLabel: "Lost followers",
    shortLabel: "Lost follower",
    sign: "−",
    color: "#B45309",
    tint: "#FEF3C7",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initialOf(username: string): string {
  return (username[0] || "?").toUpperCase();
}

function eventRows(events: AlertPayload["events"]): string {
  return events
    .map((e) => {
      const style = EVENT_STYLES[e.eventType];
      const name = e.fullName ? escapeHtml(e.fullName) : "";
      const handle = escapeHtml(e.username);
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #F0F0ED;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="36" style="vertical-align:middle;">
                  <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background-color:${style.tint};color:${style.color};text-align:center;line-height:28px;font-size:16px;font-weight:800;">${style.sign}</span>
                </td>
                <td style="vertical-align:middle;padding-left:8px;">
                  <span style="font-size:15px;font-weight:700;color:${INK};">@${handle}</span>${
        name
          ? ` <span style="font-size:13px;color:${TEXT_SECONDARY};">· ${name}</span>`
          : ""
      }
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background-color:${style.tint};color:${style.color};white-space:nowrap;">${style.shortLabel}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");
}

function eventSections(events: AlertPayload["events"]): string {
  const sections: string[] = [];

  for (const type of [
    "NEW_FOLLOWING",
    "STOPPED_FOLLOWING",
    "NEW_FOLLOWER",
    "LOST_FOLLOWER",
  ] as const) {
    const items = events.filter((e) => e.eventType === type);
    if (items.length === 0) continue;

    const style = EVENT_STYLES[type];
    sections.push(`
      <div style="margin-top:24px;">
        <div style="font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${style.color};">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${style.color};margin-right:6px;vertical-align:1px;"></span>${style.sectionLabel} (${items.length})
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
          ${eventRows(items)}
        </table>
      </div>`);
  }

  return sections.join("");
}

function buildHtml(payload: AlertPayload): string {
  const targetName = payload.targetFullName || `@${payload.targetUsername}`;
  const displayName = payload.targetFullName
    ? escapeHtml(payload.targetFullName)
    : `@${escapeHtml(payload.targetUsername)}`;
  const total = payload.events.length;
  const plural = total !== 1 ? "s" : "";

  const headline =
    total === 1
      ? "1 new change detected"
      : `${total} new changes detected`;

  const timelineUrl = `${PUBLIC_BASE_URL}/track/${encodeURIComponent(payload.targetUsername)}`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#F4F4F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F1;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color:${INK};padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="30" height="30" align="center" valign="middle" style="border-radius:50%;background-color:${INK};text-align:center;">
                    <span style="font-size:16px;color:${LIME};line-height:30px;">⚡</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:800;color:#FFFFFF;letter-spacing:-0.01em;">CheckFollows</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 4px;">
              <div style="font-size:24px;font-weight:800;color:${INK};letter-spacing:-0.02em;line-height:1.2;">${headline}</div>
              <div style="font-size:14px;color:${TEXT_SECONDARY};margin-top:6px;">
                ${displayName} <span style="color:${TEXT_TERTIARY};">(@${escapeHtml(payload.targetUsername)})</span>
              </div>

              ${eventSections(payload.events)}

              <!-- CTA -->
              <div style="margin-top:28px;padding-bottom:24px;">
                <a href="${timelineUrl}" style="display:inline-block;background-color:${LIME};color:${INK};text-decoration:none;font-size:14px;font-weight:800;padding:12px 22px;border-radius:8px;">View full timeline →</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${SURFACE_SUBTLE};border-top:1px solid ${BORDER};padding:18px 28px;">
              <div style="font-size:12px;color:${TEXT_TERTIARY};line-height:1.6;">
                You're receiving this because you're tracking <strong style="color:${TEXT_SECONDARY};">@${escapeHtml(payload.targetUsername)}</strong> on CheckFollows.
              </div>
              <div style="font-size:11px;color:#999999;margin-top:6px;">CheckFollows · team@checkfollows.com</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(payload: AlertPayload): string {
  const targetName = payload.targetFullName || `@${payload.targetUsername}`;
  const total = payload.events.length;
  const plural = total !== 1 ? "s" : "";

  const lines: string[] = [];
  for (const type of [
    "NEW_FOLLOWING",
    "STOPPED_FOLLOWING",
    "NEW_FOLLOWER",
    "LOST_FOLLOWER",
  ] as const) {
    const style = EVENT_STYLES[type];
    const items = payload.events.filter((e) => e.eventType === type);
    if (items.length === 0) continue;
    lines.push(`${style.sectionLabel} (${items.length})`);
    items.forEach((e) =>
      lines.push(`  ${style.sign} @${e.username}${e.fullName ? ` — ${e.fullName}` : ""}`)
    );
    lines.push("");
  }

  return [
    `${total} change${plural} detected for ${targetName} (@${payload.targetUsername})`,
    "",
    ...lines,
    `View full timeline: ${PUBLIC_BASE_URL}/track/${payload.targetUsername}`,
  ].join("\n");
}

// ─── Send ─────────────────────────────────────────────────────────────

export async function sendAlertEmail(payload: AlertPayload): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log("[Alerts] Resend not configured, skipping email to", payload.subscriberEmail);
    return false;
  }

  const targetName = payload.targetFullName || `@${payload.targetUsername}`;
  const total = payload.events.length;
  const plural = total !== 1 ? "s" : "";

  const newFollows = payload.events.filter((e) => e.eventType === "NEW_FOLLOWING").length;
  const unfollows = payload.events.filter((e) => e.eventType === "STOPPED_FOLLOWING").length;

  const subject =
    newFollows > 0
      ? `${newFollows} new follow${newFollows !== 1 ? "s" : ""} detected for ${targetName}`
      : unfollows > 0
        ? `${unfollows} unfollow${unfollows !== 1 ? "s" : ""} detected for ${targetName}`
        : `${total} change${plural} detected for ${targetName}`;

  try {
    await resend.emails.send({
      from: `CheckFollows <${FROM_EMAIL}>`,
      to: payload.subscriberEmail,
      subject,
      text: buildText(payload),
      html: buildHtml(payload),
    });
    console.log(`[Alerts] Email sent to ${payload.subscriberEmail} for @${payload.targetUsername} (${total} events)`);
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

  // Only pro-tier subscribers get email alerts
  const { data: subscribers } = await supabase
    .from("subscriptions")
    .select("email")
    .eq("target_id", targetId)
    .eq("active", true)
    .eq("plan", "pro");

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

// ─── Suspicious spike alerts ─────────────────────────────

export interface SpikePayload {
  targetUsername: string;
  targetFullName: string | null;
  subscriberEmail: string;
  count: number;
  threshold: number;
  follows: Array<{ username: string; fullName: string | null }>;
}

function buildSpikeHtml(payload: SpikePayload): string {
  const displayName = payload.targetFullName
    ? escapeHtml(payload.targetFullName)
    : `@${escapeHtml(payload.targetUsername)}`;
  const timelineUrl = `${PUBLIC_BASE_URL}/track/${encodeURIComponent(payload.targetUsername)}`;

  const follows = payload.follows
    .map((f) => {
      const name = f.fullName ? escapeHtml(f.fullName) : "";
      return `<tr>
          <td style="padding:10px 16px;border-bottom:1px solid #F0F0ED;">
            <span style="font-size:15px;font-weight:700;color:${INK};">@${escapeHtml(f.username)}</span>${
        name ? ` <span style="font-size:13px;color:${TEXT_SECONDARY};">· ${name}</span>` : ""
      }
          </td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#F4F4F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F1;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:${INK};padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="30" height="30" align="center" valign="middle" style="border-radius:50%;text-align:center;">
                    <span style="font-size:16px;color:${LIME};line-height:30px;">⚡</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:17px;font-weight:800;color:#FFFFFF;letter-spacing:-0.01em;">CheckFollows</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 4px;">
              <div style="font-size:24px;font-weight:800;color:${INK};letter-spacing:-0.02em;line-height:1.2;">Unusual activity detected</div>
              <div style="font-size:14px;color:${TEXT_SECONDARY};margin-top:6px;">
                ${displayName} <span style="color:${TEXT_TERTIARY};">(@${escapeHtml(payload.targetUsername)})</span> followed
                <strong style="color:${INK};">${payload.count}</strong> account${payload.count !== 1 ? "s" : ""} in one day
                (your alert threshold is ${payload.threshold}).
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
                ${follows}
              </table>
              <div style="margin-top:28px;padding-bottom:24px;">
                <a href="${timelineUrl}" style="display:inline-block;background-color:${LIME};color:${INK};text-decoration:none;font-size:14px;font-weight:800;padding:12px 22px;border-radius:8px;">View full timeline →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:${SURFACE_SUBTLE};border-top:1px solid ${BORDER};padding:18px 28px;">
              <div style="font-size:12px;color:${TEXT_TERTIARY};line-height:1.6;">
                You're receiving this because you're tracking <strong style="color:${TEXT_SECONDARY};">@${escapeHtml(payload.targetUsername)}</strong> on CheckFollows with spike alerts enabled.
              </div>
              <div style="font-size:11px;color:#999999;margin-top:6px;">CheckFollows · team@checkfollows.com</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSpikeText(payload: SpikePayload): string {
  const targetName = payload.targetFullName || `@${payload.targetUsername}`;
  const lines = payload.follows.map(
    (f) => `  + @${f.username}${f.fullName ? ` — ${f.fullName}` : ""}`
  );
  return [
    `Unusual activity: ${targetName} (@${payload.targetUsername}) followed ${payload.count} accounts in one day (threshold: ${payload.threshold}).`,
    "",
    ...lines,
    "",
    `View full timeline: ${PUBLIC_BASE_URL}/track/${payload.targetUsername}`,
  ].join("\n");
}

export async function sendSpikeEmail(payload: SpikePayload): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log("[Alerts] Resend not configured, skipping spike email to", payload.subscriberEmail);
    return false;
  }

  const targetName = payload.targetFullName || `@${payload.targetUsername}`;
  const subject = `Unusual activity: ${targetName} followed ${payload.count} accounts in one day`;

  try {
    await resend.emails.send({
      from: `CheckFollows <${FROM_EMAIL}>`,
      to: payload.subscriberEmail,
      subject,
      text: buildSpikeText(payload),
      html: buildSpikeHtml(payload),
    });
    console.log(`[Alerts] Spike email sent to ${payload.subscriberEmail} for @${payload.targetUsername} (${payload.count} follows)`);
    return true;
  } catch (err) {
    console.error("[Alerts] Failed to send spike email:", err);
    return false;
  }
}

/**
 * Send a "suspicious spike" alert when a target follows >= the subscriber's
 * configured threshold in a single scan. Pro (email-alerts) subscribers only.
 */
export async function notifySpikeSubscribers(
  targetId: string,
  targetUsername: string,
  targetFullName: string | null,
  newFollows: Array<{ username: string; fullName: string | null }>
): Promise<number> {
  if (newFollows.length === 0) return 0;

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data: subscribers } = await supabase
    .from("subscriptions")
    .select("email, spike_threshold")
    .eq("target_id", targetId)
    .eq("active", true)
    .eq("plan", "pro");

  if (!subscribers || subscribers.length === 0) return 0;

  let sent = 0;
  for (const sub of subscribers) {
    const threshold =
      typeof sub.spike_threshold === "number" && sub.spike_threshold > 0
        ? sub.spike_threshold
        : 5;
    if (newFollows.length < threshold) continue;
    if (!sub.email) continue;
    const ok = await sendSpikeEmail({
      targetUsername,
      targetFullName,
      subscriberEmail: sub.email,
      count: newFollows.length,
      threshold,
      follows: newFollows,
    });
    if (ok) sent++;
  }

  return sent;
}
