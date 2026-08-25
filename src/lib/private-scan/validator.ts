import type { StoredPage } from "./page-store";
import type { PrivateScanErrorCode } from "./errors";

/**
 * Page / cursor-chain validation (§10 of the plan).
 *
 * A list is COMPLETE only when ALL required invariants pass.
 * Any failure means the scan is discarded — no partial snapshot.
 */

export interface ValidationResult {
  valid: boolean;
  errorCode?: PrivateScanErrorCode;
  errorDetail?: string;
}

// ─── Top-level completeness check ──────────────────────────

/**
 * Full completeness check for a completed list's pages.
 * Returns `valid: true` only when all invariants hold.
 */
export function validateCompleteList(pages: StoredPage[]): ValidationResult {
  if (pages.length === 0) {
    return {
      valid: false,
      errorCode: "CURSOR_MISSING",
      errorDetail: "No pages received",
    };
  }

  // 1. Must start at page 0
  if (pages[0].pageIndex !== 0) {
    return {
      valid: false,
      errorCode: "PAGE_INDEX_GAP",
      errorDetail: `First page index is ${pages[0].pageIndex}, expected 0`,
    };
  }

  // 2. No gaps in page indices
  for (let i = 1; i < pages.length; i++) {
    const expected = pages[i - 1].pageIndex + 1;
    if (pages[i].pageIndex !== expected) {
      return {
        valid: false,
        errorCode: "PAGE_INDEX_GAP",
        errorDetail: `Page index gap at position ${i}: found ${pages[i].pageIndex}, expected ${expected}`,
      };
    }
  }

  // 3. Validate cursor chain
  const cursorResult = validateCursorChain(pages);
  if (!cursorResult.valid) return cursorResult;

  // 4. Must have a terminal page
  const lastPage = pages[pages.length - 1];
  if (!lastPage.terminal) {
    return {
      valid: false,
      errorCode: "CURSOR_MISSING",
      errorDetail: "Last page is not terminal",
    };
  }

  // 5. No repeated pages (by hash)
  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.pageHash)) {
      return {
        valid: false,
        errorCode: "PAGE_REPEATED",
        errorDetail: `Duplicate page hash at index ${page.pageIndex}`,
      };
    }
    seen.add(page.pageHash);
  }

  // 6. Every member must have a numeric Instagram ID
  for (const page of pages) {
    for (const member of page.members) {
      if (!member.instagramId || !/^\d+$/.test(member.instagramId)) {
        return {
          valid: false,
          errorCode: "INSTAGRAM_RESPONSE_MALFORMED",
          errorDetail: `Missing or non-numeric Instagram ID for ${member.username || "unknown"} at page ${page.pageIndex}`,
        };
      }
      if (!member.username) {
        return {
          valid: false,
          errorCode: "INSTAGRAM_RESPONSE_MALFORMED",
          errorDetail: `Missing username at page ${page.pageIndex}`,
        };
      }
    }
  }

  // 7. Count anomaly check (optional: flag but not fail)
  const totalUnique = new Set(
    pages.flatMap((p) => p.members.map((m) => m.instagramId))
  ).size;
  const totalRaw = pages.reduce((s, p) => s + p.rawCount, 0);
  // If raw count is wildly off from unique (e.g. >2x), it's suspicious
  if (totalRaw > totalUnique * 2 && totalUnique > 50) {
    return {
      valid: false,
      errorCode: "COUNT_ANOMALY",
      errorDetail: `Raw count ${totalRaw} is more than 2x unique count ${totalUnique}`,
    };
  }

  return { valid: true };
}

// ─── Cursor chain validation ───────────────────────────────

function validateCursorChain(pages: StoredPage[]): ValidationResult {
  for (let i = 1; i < pages.length; i++) {
    const prev = pages[i - 1];
    const curr = pages[i];

    // Previous page's next cursor must match current page's request cursor
    if (prev.nextCursorHash && prev.nextCursorHash !== curr.requestCursorHash) {
      return {
        valid: false,
        errorCode: "CURSOR_MISSING",
        errorDetail: `Cursor chain broken between page ${prev.pageIndex} and ${curr.pageIndex}`,
      };
    }
  }

  // No repeated non-terminal cursors
  const seen = new Map<string, number>();
  for (const page of pages) {
    if (page.nextCursorHash) {
      const prev = seen.get(page.nextCursorHash);
      if (prev !== undefined) {
        return {
          valid: false,
          errorCode: "CURSOR_REPEATED",
          errorDetail: `Cursor ${page.nextCursorHash} seen at pages ${prev} and ${page.pageIndex}`,
        };
      }
      seen.set(page.nextCursorHash, page.pageIndex);
    }
  }

  return { valid: true };
}

// ─── Single-page checks (used during upload) ───────────────

/**
 * Quick checks run on each incoming page before accepting it into staging.
 * Does NOT check cursor chain (that's done at finalization).
 */
export function validateIncomingPage(
  pageIndex: number,
  pagesSoFar: number,
  terminal: boolean,
  memberCount: number
): ValidationResult {
  // Must start at 0
  if (pagesSoFar === 0 && pageIndex !== 0) {
    return {
      valid: false,
      errorCode: "PAGE_INDEX_GAP",
      errorDetail: "First page must be index 0",
    };
  }

  // Must be the next expected index
  if (pagesSoFar > 0 && pageIndex !== pagesSoFar) {
    return {
      valid: false,
      errorCode: "PAGE_INDEX_GAP",
      errorDetail: `Expected page index ${pagesSoFar}, got ${pageIndex}`,
    };
  }

  // Terminal page is fine with 0 members (last page can be empty)
  // Non-terminal pages should have members
  if (!terminal && memberCount === 0) {
    return {
      valid: false,
      errorCode: "INSTAGRAM_RESPONSE_MALFORMED",
      errorDetail: "Non-terminal page has 0 members",
    };
  }

  return { valid: true };
}