import { NextResponse } from "next/server";
import {
  getAuthUser,
  hasActiveSubscription,
  ownsTarget,
} from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getRemainingCredits, consumeCredit } from "@/lib/purchases";

/**
 * GET /api/instagram/export?targetId=...
 * Downloads a CSV of the target's full follow/unfollow timeline ("evidence
 * report"). Requires an active subscription + a one-time export credit.
 */
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasActiveSubscription(user.id))) {
    return NextResponse.json(
      { error: "An active subscription is required" },
      { status: 402 }
    );
  }

  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("targetId");
  if (!targetId) {
    return NextResponse.json({ error: "targetId is required" }, { status: 400 });
  }
  if (!(await ownsTarget(user.id, targetId, user.email))) {
    return NextResponse.json(
      { error: "You're not tracking this account" },
      { status: 403 }
    );
  }

  // Pre-check credits before doing any work.
  if ((await getRemainingCredits(user.id, "export")) <= 0) {
    return NextResponse.json(
      {
        error: "History export is a one-time add-on. Please purchase it to continue.",
        needsPurchase: true,
      },
      { status: 402 }
    );
  }

  const supabase = createServerClient();

  const { data: target } = await supabase
    .from("instagram_targets")
    .select("username, full_name")
    .eq("id", targetId)
    .single();
  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const { data: events } = await supabase
    .from("follow_events")
    .select("event_type, username, full_name, detected_at, confirmed")
    .eq("target_id", targetId)
    .is("invalidated_at", null)
    .order("detected_at", { ascending: false })
    .limit(2000);

  const ok = await consumeCredit(user.id, "export");
  if (!ok) {
    return NextResponse.json(
      {
        error: "History export is a one-time add-on. Please purchase it to continue.",
        needsPurchase: true,
      },
      { status: 402 }
    );
  }

  const esc = (s: string | null) => `"${String(s ?? "").replace(/"/g, '""')}"`;

  const header = "event_type,username,full_name,detected_at,confirmed";
  const rows = (events || []).map((e) =>
    [
      esc(e.event_type),
      esc(e.username),
      esc(e.full_name),
      esc(e.detected_at),
      e.confirmed ? "true" : "false",
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const filename = `checkfollows-${target.username}-history.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
