/**
 * Private mobile scan failure taxonomy (docs/private-mobile-scan-plan.md §20).
 *
 * One shared vocabulary for API routes, validation, UI copy and telemetry so
 * a partial scan can never be presented as success. Every non-success state
 * must preserve the user's last known-good snapshot — finalization is the
 * only code path that writes snapshots/events.
 */

export type PrivateScanErrorCode =
  // Handshake / job integrity
  | "NOT_INSTAGRAM_PAGE"
  | "TARGET_MISMATCH"
  | "VIEWER_CHANGED"
  | "CHECKFOLLOWS_JOB_EXPIRED"
  | "CHECKFOLLOWS_JOB_ALREADY_FINALIZED"
  // Instagram-side conditions (fail closed, stop immediately)
  | "INSTAGRAM_LOGIN_REQUIRED"
  | "INSTAGRAM_PRIVATE_ACCESS_DENIED"
  | "INSTAGRAM_RATE_LIMITED"
  | "INSTAGRAM_CHALLENGE"
  | "INSTAGRAM_FORBIDDEN"
  | "INSTAGRAM_RESPONSE_MALFORMED"
  | "INSTAGRAM_SCHEMA_CHANGED"
  // Runner / network
  | "JAVASCRIPT_TIMEOUT"
  | "NETWORK_INTERRUPTED"
  // Pagination integrity
  | "CURSOR_MISSING"
  | "CURSOR_REPEATED"
  | "PAGE_REPEATED"
  | "PAGE_INDEX_GAP"
  | "TARGET_CHANGED"
  | "COUNT_ANOMALY"
  | "UNSTABLE_TRAVERSAL"
  // Server-side rejection
  | "PAYLOAD_REJECTED"
  | "SERVER_VALIDATION_FAILED";

export type FailureCategory =
  | "handshake"
  | "instagram_safety"
  | "integrity"
  | "network"
  | "rejection";

const CATEGORY_BY_CODE: Record<PrivateScanErrorCode, FailureCategory> = {
  NOT_INSTAGRAM_PAGE: "handshake",
  TARGET_MISMATCH: "handshake",
  VIEWER_CHANGED: "handshake",
  CHECKFOLLOWS_JOB_EXPIRED: "handshake",
  CHECKFOLLOWS_JOB_ALREADY_FINALIZED: "handshake",

  INSTAGRAM_LOGIN_REQUIRED: "instagram_safety",
  INSTAGRAM_PRIVATE_ACCESS_DENIED: "instagram_safety",
  INSTAGRAM_RATE_LIMITED: "instagram_safety",
  INSTAGRAM_CHALLENGE: "instagram_safety",
  INSTAGRAM_FORBIDDEN: "instagram_safety",
  INSTAGRAM_RESPONSE_MALFORMED: "instagram_safety",
  INSTAGRAM_SCHEMA_CHANGED: "instagram_safety",

  JAVASCRIPT_TIMEOUT: "network",
  NETWORK_INTERRUPTED: "network",

  CURSOR_MISSING: "integrity",
  CURSOR_REPEATED: "integrity",
  PAGE_REPEATED: "integrity",
  PAGE_INDEX_GAP: "integrity",
  TARGET_CHANGED: "integrity",
  COUNT_ANOMALY: "integrity",
  UNSTABLE_TRAVERSAL: "integrity",

  PAYLOAD_REJECTED: "rejection",
  SERVER_VALIDATION_FAILED: "rejection",
};

/**
 * Safe user-facing copy. Never implies a partial scan succeeded; never leaks
 * Instagram internals. See plan §12 ("User-facing failure copy principle").
 */
const USER_COPY_BY_CODE: Record<PrivateScanErrorCode, string> = {
  NOT_INSTAGRAM_PAGE:
    "This scan must run on an Instagram page. Open the profile in Safari and try again.",
  TARGET_MISMATCH:
    "The page you scanned doesn't match the account you started from.",
  VIEWER_CHANGED:
    "Your Instagram session changed mid-scan, so we discarded it to stay accurate.",
  CHECKFOLLOWS_JOB_EXPIRED:
    "That scan request expired. Start a new scan from your tracking page.",
  CHECKFOLLOWS_JOB_ALREADY_FINALIZED: "This scan was already finished.",

  INSTAGRAM_LOGIN_REQUIRED:
    "Instagram asked you to log in before this list could be read. Nothing was changed in your history.",
  INSTAGRAM_PRIVATE_ACCESS_DENIED:
    "Instagram didn't let you view this private account's lists, so nothing was saved.",
  INSTAGRAM_RATE_LIMITED:
    "Instagram asked us to slow down. Nothing was changed in your history — try again later.",
  INSTAGRAM_CHALLENGE:
    "Instagram asked for extra verification, so we stopped this scan. Nothing was changed in your history.",
  INSTAGRAM_FORBIDDEN:
    "Instagram refused part of this scan. Nothing was changed in your history.",
  INSTAGRAM_RESPONSE_MALFORMED:
    "We couldn't prove the full list was loaded, so we discarded this scan.",
  INSTAGRAM_SCHEMA_CHANGED:
    "Instagram changed how its lists load. This scan was discarded — check for a Shortcut update.",

  JAVASCRIPT_TIMEOUT:
    "The scan took too long and was stopped safely. Nothing was changed in your history.",
  NETWORK_INTERRUPTED:
    "Your connection dropped during the scan, so we discarded it. Nothing was changed.",

  CURSOR_MISSING:
    "We couldn't prove every page of the list loaded, so we discarded this scan.",
  CURSOR_REPEATED:
    "We couldn't prove every page of the list loaded, so we discarded this scan.",
  PAGE_REPEATED:
    "We couldn't prove every page of the list loaded, so we discarded this scan.",
  PAGE_INDEX_GAP:
    "We couldn't prove every page of the list loaded, so we discarded this scan.",
  TARGET_CHANGED:
    "This account changed while scanning, so we discarded the result to stay accurate.",
  COUNT_ANOMALY:
    "The counts didn't match the collected list, so we discarded this scan.",
  UNSTABLE_TRAVERSAL:
    "This account changed too much while scanning, so we discarded the result.",

  PAYLOAD_REJECTED: "Something went wrong with the scan data upload.",
  SERVER_VALIDATION_FAILED:
    "We couldn't verify this scan, so your previous history is unchanged.",
};

export function failureCategory(code: PrivateScanErrorCode): FailureCategory {
  return CATEGORY_BY_CODE[code];
}

export function userFacingCopy(code: PrivateScanErrorCode): string {
  return USER_COPY_BY_CODE[code];
}

export function isPrivateScanErrorCode(value: unknown): value is PrivateScanErrorCode {
  return typeof value === "string" && value in CATEGORY_BY_CODE;
}
