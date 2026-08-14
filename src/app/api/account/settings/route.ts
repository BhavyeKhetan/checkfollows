import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/account/settings
 * Body: { spike_threshold: number }
 *
 * Sets the "suspicious spike" threshold — the number of new follows in a single
 * scan that triggers an alert — for all of the user's subscription rows.
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const raw = parseInt(String(body.spike_threshold), 10);
  const threshold = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 50) : null;

  if (threshold === null) {
    return NextResponse.json(
      { error: "spike_threshold must be a number" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  await supabase
    .from("subscriptions")
    .update({ spike_threshold: threshold })
    .eq("user_id", user.id);

  return NextResponse.json({ success: true, spike_threshold: threshold });
}
