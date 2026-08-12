/**
 * Cron endpoint - triggered by Vercel Cron Jobs (or external scheduler).
 * Scans all instagram_targets whose next_scan_at <= now(),
 * runs the diff engine, and stores new snapshots + events.
 *
 * Protected by CRON_SECRET to prevent unauthorized triggers.
 * Vercel Cron schedule: every 30 minutes (configured in vercel.json)
 */

import { NextResponse } from "next/server";
import { processDueScans } from "@/lib/monitoring";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueScans();

    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      failed: result.failed,
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
