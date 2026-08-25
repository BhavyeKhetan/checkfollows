import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  bearerToken,
  verifyScanToken,
  tokenErrorResponse,
} from "@/lib/private-scan/token";
import { finalizeList } from "@/lib/private-scan/finalize";
import { getPageCountForList, deletePagesForJob } from "@/lib/private-scan/page-store";
import { assertPrivateScanEnabled } from "@/lib/private-scan/feature-flag";
import type { FinalizeResponse } from "@/lib/private-scan/contracts";

/**
 * POST /api/private-scan/finalize
 *
 * Final orchestration step. Runs finalizeList for every requested list type,
 * then marks the job as completed. Returns a URL the Shortcut opens to take
 * the user back to their CheckFollows results page.
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
      l: requestedLists,
    } = result.payload;

    const supabase = createServerClient();

    // ─── Load target for redirect URL ──────────────────
    const { data: target } = await supabase
      .from("instagram_targets")
      .select("username")
      .eq("id", targetId)
      .single();

    if (!target) {
      return NextResponse.json(
        { success: false, errorCode: "TARGET_MISMATCH" },
        { status: 404 }
      );
    }

    // ─── Finalize each list type ───────────────────────
    let totalSnapshotCount = 0;
    let totalEventCount = 0;
    let isBaseline = false;
    const errors: string[] = [];

    for (const rawType of requestedLists) {
      const listType = rawType as "followers" | "following";
      const pageCount = await getPageCountForList(jobId, listType);
      if (pageCount === 0) {
        // No pages received for this list — skip
        continue;
      }

      const listResult = await finalizeList(
        jobId,
        userId,
        targetId,
        listType as "followers" | "following"
      );

      if (listResult.success) {
        totalSnapshotCount++;
        totalEventCount += listResult.newEventCount + listResult.lostEventCount;
        if (listResult.isBaseline) isBaseline = true;
      } else {
        errors.push(
          `${listType}: ${listResult.errorCode || "unknown error"}`
        );
      }
    }

    // If we had any list to process but none succeeded, fail the job
    if (totalSnapshotCount === 0 && errors.length > 0) {
      await supabase
        .from("private_scan_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_code: "SERVER_VALIDATION_FAILED",
          error_detail_safe: errors.join("; "),
        })
        .eq("id", jobId);

      return NextResponse.json(
        {
          success: false,
          errorCode: "SERVER_VALIDATION_FAILED",
          error: "All list finalizations failed",
        },
        { status: 422 }
      );
    }

    // ─── Mark job as completed ─────────────────────────
    await supabase
      .from("private_scan_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // ─── Clean up staging pages ────────────────────────
    await deletePagesForJob(jobId);

    // ─── Build results URL ─────────────────────────────
    const resultsUrl = new URL(
      `/track/${target.username}`,
      request.url
    );
    resultsUrl.searchParams.set("privateScan", jobId);
    resultsUrl.searchParams.set("completed", "true");

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_URL ||
      `https://${request.headers.get("host")}`;
    const fullUrl = `${baseUrl}${resultsUrl.pathname}${resultsUrl.search}`;

    const response: FinalizeResponse = {
      success: true,
      snapshotCount: totalSnapshotCount,
      totalEventCount,
      resultsUrl: fullUrl,
      isBaseline,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Private scan finalize error:", error);
    return NextResponse.json(
      {
        success: false,
        errorCode: "SERVER_VALIDATION_FAILED",
        error: "Failed to finalize scan",
      },
      { status: 500 }
    );
  }
}