import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const targetId = searchParams.get("targetId");
  const confirmedOnly = searchParams.get("confirmed") !== "false"; // default true
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    const supabase = createServerClient();
    let target;

    if (targetId) {
      const { data } = await supabase
        .from("instagram_targets")
        .select("id, username")
        .eq("id", targetId)
        .single();
      target = data;
    } else if (username) {
      const clean = username.replace(/^@/, "").trim();
      const { data } = await supabase
        .from("instagram_targets")
        .select("id, username")
        .eq("username", clean.toLowerCase())
        .maybeSingle();
      target = data;
    }

    if (!target) {
      return NextResponse.json({ success: false, error: "Target not found" }, { status: 404 });
    }

    let query = supabase
      .from("follow_events")
      .select("*")
      .eq("target_id", target.id)
      .order("detected_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (confirmedOnly) {
      query = query.eq("confirmed", true);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Events fetch error:", error);
      return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      targetUsername: target.username,
      events: events || [],
    });
  } catch (error) {
    console.error("Events API error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
