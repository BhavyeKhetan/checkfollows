import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { extractInstagramUsername } from "@/lib/instagram/normalize";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * POST /api/onboarding/lead
 * Body: { email, username?, targetId?, relationship? }
 *
 * Saves the visitor's email (and context) as soon as they enter the funnel, so
 * the lead is retained even if they abandon the paywall before paying.
 * Best-effort: the funnel never blocks on this call.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const rawUsername = typeof body.username === "string" ? body.username : null;
    const username = rawUsername ? extractInstagramUsername(rawUsername) || null : null;
    const targetId = typeof body.targetId === "string" ? body.targetId : null;
    const relationship =
      typeof body.relationship === "string" ? body.relationship : null;

    const supabase = createServerClient();

    // Upsert by email (a re-entry updates context instead of duplicating).
    const { error } = await supabase.from("leads").upsert(
      {
        email,
        ...(username ? { username } : {}),
        ...(targetId ? { target_id: targetId } : {}),
        ...(relationship ? { relationship } : {}),
      },
      { onConflict: "email" }
    );

    if (error) {
      // If the table isn't deployed yet, fail silently — the funnel continues.
      console.warn("onboarding/lead: failed to save lead:", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.warn("onboarding/lead error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
