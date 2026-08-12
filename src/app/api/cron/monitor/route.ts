/**
 * Cron endpoint — triggered by Vercel Cron Jobs.
 * Scans all instagram_targets where monitoring_enabled=true AND next_scan_at <= now().
 *
 * Architecture:
 *   - Scheduler runs every hour (vercel.json cron)
 *   - Query: monitoring_enabled=true, next_scan_at <= now()
 *   - Batch by MONITORING_BATCH_SIZE (default 10)
 *   - Scan frequency is set per target (default 24h)
 *
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { processDueScans } from "@/lib/monitoring";
import { notifySubscribers } from "@/lib/email/alerts";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
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
