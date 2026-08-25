import { NextResponse } from "next/server";
import {
  bearerToken,
  verifyScanToken,
  tokenErrorResponse,
} from "@/lib/private-scan/token";
import { hasTerminalPage } from "@/lib/private-scan/page-store";
import { finalizeList } from "@/lib/private-scan/finalize";
import { assertPrivateScanEnabled } from "@/lib/private-scan/feature-flag";
import type { FinalizeListRequest, FinalizeListResponse } from "@/lib/private-scan/contracts";

/**
 * POST /api/private-scan/finalize-list
 *
 * Called by the Shortcut after all pages for one list type have been uploaded.
 * Triggers completeness validation + snapshot + diff + event insertion.
 * Auth: Bearer scanToken.
 */
export async function POST(request: Request) {
  try {
    // ─── Kill switch ───────────────────────────────────
    assertPrivateScanEnabled();

    // ─── Token auth ────────────────────────────────────
    const token = bearerToken(request);
    const result = verifyScanToken(token);
    if (!result.ok) {
      return tokenErrorResponse(result.reason);
    }

    const {
      j: jobId,
      u: userId,
      t: targetId,
      l: permittedLists,
    } = result.payload;

    // ─── Parse body ────────────────────────────────────
    const body: FinalizeListRequest = await request.json().catch(() => ({}));
    const listType = body.listType;

    if (
      !listType ||
      !(listType === "followers" || listType === "following")
    ) {
      return NextResponse.json(
        { success: false, errorCode: "SERVER_VALIDATION_FAILED" },
        { status: 400 }
      );
    }

    if (!permittedLists.includes(listType)) {
      return NextResponse.json(
        { success: false, errorCode: "SERVER_VALIDATION_FAILED" },
        { status: 403 }
      );
    }

    // ─── Check terminal page was received ──────────────
    const terminal = await hasTerminalPage(jobId, listType);
    if (!terminal) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "CURSOR_MISSING",
          error: "No terminal page received yet. Cannot finalize.",
        },
        { status: 400 }
      );
    }

    // ─── Run finalization ──────────────────────────────
    const result2 = await finalizeList(jobId, userId, targetId, listType);

    if (!result2.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: result2.errorCode,
          error: result2.errorDetail,
        },
        { status: 422 }
      );
    }

    const response: FinalizeListResponse = {
      listComplete: true,
      memberCount: result2.memberCount,
      snapshotId: result2.snapshotId,
      isBaseline: result2.isBaseline,
      newEventCount: result2.newEventCount,
      lostEventCount: result2.lostEventCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Private scan finalize-list error:", error);
    return NextResponse.json(
      { success: false, errorCode: "SERVER_VALIDATION_FAILED" },
      { status: 500 }
    );
  }
}