import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrivateScanErrorCode } from "./errors";

/**
 * Short-lived, job-scoped scan token (plan §7).
 *
 * NOT a CheckFollows session token. Scoped to exactly:
 *   one user + one job + one target + permitted list types,
 * with a short expiry. Accepted only by the /api/private-scan/* routes.
 *
 * Format: base64url(payload JSON) + "." + base64url(HMAC-SHA256)
 */

export interface ScanTokenPayload {
  /** Job id. */
  j: string;
  /** Owner user id (Supabase UUID). */
  u: string;
  /** Target id (Supabase UUID). */
  t: string;
  /** Permitted list types. */
  l: string[];
  /** Expiry, epoch seconds. */
  exp: number;
  /** Issued at, epoch seconds. */
  iat: number;
  /** Shortcut version that was offered at start time. */
  sv?: string;
}

export const DEFAULT_SCAN_TOKEN_TTL_SECONDS = 30 * 60; // one scan session

function getSecret(explicit?: string): string {
  const secret = explicit || process.env.PRIVATE_SCAN_TOKEN_SECRET;
  if (!secret) {
    throw new Error("Missing PRIVATE_SCAN_TOKEN_SECRET");
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signScanToken(
  payload: Omit<ScanTokenPayload, "iat" | "exp"> & { iat?: number; exp?: number },
  options: { secret?: string; ttlSeconds?: number } = {}
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: ScanTokenPayload = {
    ...payload,
    iat: payload.iat ?? now,
    exp: payload.exp ?? (payload.iat ?? now) + (options.ttlSeconds ?? DEFAULT_SCAN_TOKEN_TTL_SECONDS),
  };
  const body = b64url(JSON.stringify(full));
  return `${body}.${sign(body, getSecret(options.secret))}`;
}

export type VerifyResult =
  | { ok: true; payload: ScanTokenPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Constant-time verify + expiry check. Never throws. */
export function verifyScanToken(
  token: string | null | undefined,
  options: { secret?: string; now?: number } = {}
): VerifyResult {
  if (!token) return { ok: false, reason: "malformed" };
  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expectedSig: string;
  try {
    expectedSig = sign(body, getSecret(options.secret));
  } catch {
    // Missing secret is a server misconfiguration — treat as bad signature.
    return { ok: false, reason: "bad_signature" };
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: ScanTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.j !== "string" ||
    typeof payload.u !== "string" ||
    typeof payload.t !== "string" ||
    !Array.isArray(payload.l) ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (now >= payload.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}

/**
 * Extract the Bearer token from an Authorization header.
 * The Shortcut sends: Authorization: Bearer <scanToken>
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Standard error response for a failed token check. Maps to the shared
 * failure taxonomy so the Shortcut and UI can react precisely.
 */
export function tokenErrorResponse(reason: Exclude<VerifyResult, { ok: true }>["reason"]) {
  const code: PrivateScanErrorCode =
    reason === "expired" ? "CHECKFOLLOWS_JOB_EXPIRED" : "SERVER_VALIDATION_FAILED";
  return Response.json(
    { success: false, errorCode: code },
    { status: reason === "expired" ? 401 : 403 }
  );
}
