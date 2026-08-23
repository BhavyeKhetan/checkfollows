import { NextResponse } from "next/server";

/**
 * Legacy preview endpoint intentionally disabled.
 *
 * It previously made two public paid Actor calls (following + followers) and
 * returned fabricated people when the provider failed. Public profile preview
 * now comes from /api/instagram/search and never fetches either membership
 * list. Paid complete following scans must use the scan-credit paths.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "List previews are no longer available from this endpoint.",
    },
    { status: 410 }
  );
}
