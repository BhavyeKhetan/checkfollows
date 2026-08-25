import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  bearerToken,
  verifyScanToken,
  tokenErrorResponse,
} from "@/lib/private-scan/token";
import { assertPrivateScanEnabled, isAdapterVersionAccepted } from "@/lib/private-scan/feature-flag";
import { trackServer } from "@/lib/mixpanel-server";
import type { BootstrapRequest, BootstrapResponse } from "@/lib/private-scan/contracts";

/**
 * POST /api/private-scan/bootstrap
 *
 * First handshake from the Shortcut: confirm we're on an Instagram page and
 * the job is still open, record viewer identity, and hand back the
 * server-truth target identity (numeric Instagram id + username) that drives
 * the /api/v1/friendships REST pagination.
 *
 * The target is derived from the job (which the scan token is scoped to),
 * NOT from page-scraped data — the modern Instagram web no longer exposes a
 * reliable window._sharedData, so we never ask the Shortcut to scrape it.
 *
 * Auth: Bearer scanToken (from clipboard).
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

    const { j: jobId, u: userId, t: targetId, l: permittedLists } = result.payload;

    // ─── Parse body ────────────────────────────────────
    const body: BootstrapRequest = await request.json().catch(() => ({}));
    const {
      hostname,
      viewerInstagramId = null,
      viewerUsername = null,
      shortcutVersion = null,
      adapterVersion = null,
    } = body;

    // ─── Verify active page is Instagram ───────────────
    if (!hostname || !hostname.endsWith("instagram.com")) {
      void trackServer("private_scan_bootstrap_failed", {
        error_code: "NOT_INSTAGRAM_PAGE",
        user_id: userId,
        target_id: targetId,
      });
      return NextResponse.json(
        { success: false, errorCode: "NOT_INSTAGRAM_PAGE" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // ─── Verify job is still open ──────────────────────
    const { data: job } = await supabase
      .from("private_scan_jobs")
      .select("id, status, target_id, expires_at")
      .eq("id", jobId)
      .eq("status", "open")
      .single();

    if (!job) {
      void trackServer("private_scan_bootstrap_failed", {
        error_code: "CHECKFOLLOWS_JOB_EXPIRED",
        user_id: userId,
        target_id: targetId,
      });
      return NextResponse.json(
        { success: false, errorCode: "CHECKFOLLOWS_JOB_EXPIRED" },
        { status: 410 }
      );
    }

    // Check expiry
    if (new Date(job.expires_at) < new Date()) {
      await supabase
        .from("private_scan_jobs")
        .update({ status: "expired" })
        .eq("id", jobId);
      void trackServer("private_scan_bootstrap_failed", {
        error_code: "CHECKFOLLOWS_JOB_EXPIRED",
        user_id: userId,
        target_id: targetId,
      });
      return NextResponse.json(
        { success: false, errorCode: "CHECKFOLLOWS_JOB_EXPIRED" },
        { status: 410 }
      );
    }

    // ─── Load server-truth target identity ─────────────
    const { data: target } = await supabase
      .from("instagram_targets")
      .select("id, instagram_id, username")
      .eq("id", targetId)
      .single();

    if (!target) {
      void trackServer("private_scan_bootstrap_failed", {
        error_code: "TARGET_MISMATCH",
        user_id: userId,
        target_id: targetId,
      });
      return NextResponse.json(
        { success: false, errorCode: "TARGET_MISMATCH" },
        { status: 400 }
      );
    }

    // ─── Record viewer identity + version info on the job ─────
    await supabase
      .from("private_scan_jobs")
      .update({
        viewer_instagram_id: viewerInstagramId,
        viewer_username: viewerUsername,
        ...(shortcutVersion ? { shortcut_version: shortcutVersion } : {}),
        ...(adapterVersion ? { adapter_version: adapterVersion } : {}),
      })
      .eq("id", jobId);

    // Check adapter version gating after recording
    if (adapterVersion && !isAdapterVersionAccepted(adapterVersion)) {
      void trackServer("private_scan_bootstrap_failed", {
        error_code: "INSTAGRAM_SCHEMA_CHANGED",
        user_id: userId,
        target_id: targetId,
        adapter_version: adapterVersion,
      });
      return NextResponse.json(
        {
          success: false,
          errorCode: "INSTAGRAM_SCHEMA_CHANGED",
          error: "Your Shortcut is outdated. Please update to the latest version to continue scanning.",
        },
        { status: 400 }
      );
    }

    // ─── Response ──────────────────────────────────────
    void trackServer("private_scan_bootstrap_succeeded", {
      user_id: userId,
      target_id: targetId,
      viewer_instagram_id: viewerInstagramId ?? undefined,
    });

    const response: BootstrapResponse = {
      ok: true,
      permittedLists,
      targetInstagramId: target.instagram_id,
      targetUsername: target.username,
      viewerRecorded: !!viewerInstagramId,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Private scan bootstrap error:", error);
    return NextResponse.json(
      { success: false, errorCode: "SERVER_VALIDATION_FAILED" },
      { status: 500 }
    );
  }
}
