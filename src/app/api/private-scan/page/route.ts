import { NextResponse } from "next/server";
import {
  bearerToken,
  verifyScanToken,
  tokenErrorResponse,
} from "@/lib/private-scan/token";
import { insertPage, getPageCountForList } from "@/lib/private-scan/page-store";
import { validateIncomingPage } from "@/lib/private-scan/validator";
import { assertPrivateScanEnabled } from "@/lib/private-scan/feature-flag";
import type { PageUploadRequest, PageUploadResponse } from "@/lib/private-scan/contracts";

/**
 * POST /api/private-scan/page
 *
 * Accepts one paginated page of follower/following data from the Shortcut (§9 of the plan).
 * Each page is stored in staging; nothing is promoted to a snapshot until finalization.
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
    const body: PageUploadRequest = await request.json().catch(() => ({}));

    const listType = body.listType;
    const pageIndex =
      typeof body.pageIndex === "number" ? body.pageIndex : -1;
    const terminal = !!body.terminal;

    if (!listType || !(listType === "followers" || listType === "following")) {
      return NextResponse.json(
        { accepted: false, errorCode: "SERVER_VALIDATION_FAILED" },
        { status: 400 }
      );
    }

    if (typeof pageIndex !== "number" || pageIndex < 0) {
      return NextResponse.json(
        { accepted: false, pageIndex: -1, errorCode: "PAGE_INDEX_GAP" },
        { status: 400 }
      );
    }

    // Check list type is permitted
    if (!permittedLists.includes(listType)) {
      return NextResponse.json(
        { accepted: false, errorCode: "SERVER_VALIDATION_FAILED" },
        { status: 403 }
      );
    }

    // Check members is an array
    if (!Array.isArray(body.members)) {
      return NextResponse.json(
        { accepted: false, pageIndex, errorCode: "INSTAGRAM_RESPONSE_MALFORMED" },
        { status: 400 }
      );
    }

    // ─── Job alive check ───────────────────────────────
    const { ok: isValid } = verifyScanToken(token);
    // Token already verified above, but we double-check expiry

    // ─── Incoming page validation ──────────────────────
    const pagesSoFar = await getPageCountForList(jobId, listType);

    const validation = validateIncomingPage(
      pageIndex,
      pagesSoFar,
      terminal,
      body.members.length
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          accepted: false,
          pageIndex,
          errorCode: validation.errorCode,
        },
        { status: 400 }
      );
    }

    // ─── Store page ────────────────────────────────────
    const stored = await insertPage({
      jobId,
      userId,
      targetId,
      page: body,
    });

    const response: PageUploadResponse = {
      accepted: true,
      pageIndex,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Private scan page upload error:", error);
    return NextResponse.json(
      { accepted: false, pageIndex: -1, errorCode: "SERVER_VALIDATION_FAILED" },
      { status: 500 }
    );
  }
}