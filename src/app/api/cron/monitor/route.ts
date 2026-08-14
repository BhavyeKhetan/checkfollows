/**
 * Cron endpoint — scans all instagram_targets where monitoring_enabled=true
 * AND next_scan_at <= now(), batched, with diff + email alerts.
 *
 * Scheduling:
 *   - Supabase pg_cron fires this HOURLY via POST (see migration
 *     20260816000000_add_hourly_monitor_cron.sql). Hourly is the real
 *     cadence — targets are picked up within ~1h of their 24h due time.
 *   - Vercel Cron fires this once/day (0 0 * * *) as a safety net, since
 *     Vercel cron is limited to one run/day on this plan.
 *
 * Both schedulers are safe to overlap: processDueScans() atomically claims
 * due targets, so a target is only ever scanned once per window.
 *
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { processDueScans } from "@/lib/monitoring";
import { notifySubscribers, notifySpikeSubscribers } from "@/lib/email/alerts";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return runMonitor(request);
}

// pg_net only offers http_post, so the Supabase scheduler calls us via POST.
export async function POST(request: Request) {
  return runMonitor(request);
}

async function runMonitor(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get("authorization") || "";
  const querySecret = searchParams.get("secret");
  const expected = process.env.CRON_SECRET || "";

  // Vercel auto-attaches CRON_SECRET as an Authorization Bearer token;
  // the query-param path remains for manual/test invocations.
  const authorized =
    !!expected &&
    (authHeader === `Bearer ${expected}` || querySecret === expected);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueScans();

    // Send email alerts to subscribers for new confirmed events
    let emailsSent = 0;
    if (result.scanned > 0) {
      const supabase = createServerClient();

      for (const scanResult of result.results) {
        if (scanResult.status !== "completed" || scanResult.events.length === 0) continue;

        const { data: target } = await supabase
          .from("instagram_targets")
          .select("username, full_name")
          .eq("id", scanResult.targetId)
          .single();

        if (!target) continue;

        const confirmedEvents = scanResult.events
          .filter((e) => e.confirmed)
          .map((e) => ({
            eventType: e.eventType,
            username: e.username,
            fullName: e.fullName,
          }));

        if (confirmedEvents.length > 0) {
          const sent = await notifySubscribers(
            scanResult.targetId,
            target.username,
            target.full_name,
            confirmedEvents
          );
          emailsSent += sent;
        }

        // Suspicious-spike alert: many new follows in a single scan.
        const newFollowEvents = scanResult.events
          .filter((e) => e.eventType === "NEW_FOLLOWING")
          .map((e) => ({ username: e.username, fullName: e.fullName }));
        if (newFollowEvents.length > 0) {
          const spikeSent = await notifySpikeSubscribers(
            scanResult.targetId,
            target.username,
            target.full_name,
            newFollowEvents
          );
          emailsSent += spikeSent;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      failed: result.failed,
      suspect: result.suspect,
      emailsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cron monitor failed:", message);
    return NextResponse.json(
      { ok: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
