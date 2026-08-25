import { createHash } from "node:crypto";
import { createServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { ScanMember, PageUploadRequest } from "./contracts";

/**
 * Page staging store (§9, §10 of the plan).
 *
 * Each page submitted by the Shortcut is stored here temporarily.
 * Pages are validated and validated before being promoted to snapshots.
 */

export interface StoredPage {
  id: string;
  jobId: string;
  userId: string;
  targetId: string;
  listType: "followers" | "following";
  pageIndex: number;
  requestCursorHash: string | null;
  nextCursorHash: string | null;
  terminal: boolean;
  rawCount: number;
  uniqueCount: number;
  pageHash: string;
  members: ScanMember[];
  receivedAt: string;
}

// ─── Hashing utilities ─────────────────────────────────────

function hashCursor(cursor: string | null | undefined): string | null {
  if (!cursor) return null;
  return createHash("sha256").update(cursor).digest("hex").slice(0, 16);
}

function hashPage(members: ScanMember[], nextCursor: string | null): string {
  const ids = members.map((m) => m.instagramId).sort().join(",");
  return createHash("sha256")
    .update(`${ids}|${nextCursor ?? "terminal"}`)
    .digest("hex")
    .slice(0, 32);
}

// ─── Insert ────────────────────────────────────────────────

export interface InsertPageParams {
  jobId: string;
  userId: string;
  targetId: string;
  page: PageUploadRequest;
}

/**
 * Insert a single page into staging. Deduplicates duplicate page_index
 * (idempotent: same page_index for the same listType overwrites).
 */
export async function insertPage(params: InsertPageParams): Promise<{
  id: string;
  duplicate: boolean;
}> {
  const { jobId, userId, targetId, page } = params;
  const supabase = createServerClient();

  const requestCursorHash = hashCursor(page.requestCursor);
  const nextCursorHash = hashCursor(page.nextCursor);
  const uniqueIds = new Set(page.members.map((m) => m.instagramId));
  const pageHash = hashPage(page.members, page.nextCursor ?? null);

  // Upsert: unique on (job_id, list_type, page_index)
  const { data, error } = await supabase
    .from("private_scan_pages")
    .upsert(
      {
        job_id: jobId,
        user_id: userId,
        target_id: targetId,
        list_type: page.listType,
        page_index: page.pageIndex,
        request_cursor_hash: requestCursorHash,
        next_cursor_hash: nextCursorHash,
        terminal: page.terminal,
        raw_count: page.responseEvidence?.rawCount ?? page.members.length,
        unique_count: uniqueIds.size,
        page_hash: pageHash,
        members: page.members as unknown as Json,
        received_at: new Date().toISOString(),
      },
      {
        onConflict: "job_id, list_type, page_index",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert private scan page:", error);
    throw new Error("Failed to store scan page");
  }

  return { id: data.id, duplicate: false };
}

// ─── Query ─────────────────────────────────────────────────

/** Get all pages for a job+listType ordered by page_index. */
export async function getPagesForList(
  jobId: string,
  listType: "followers" | "following"
): Promise<StoredPage[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("private_scan_pages")
    .select("*")
    .eq("job_id", jobId)
    .eq("list_type", listType)
    .order("page_index", { ascending: true });

  if (error) {
    console.error("Failed to fetch scan pages:", error);
    throw new Error("Failed to fetch scan pages");
  }

  return (data || []).map((row) => ({
    id: row.id,
    jobId: row.job_id,
    userId: row.user_id,
    targetId: row.target_id,
    listType: row.list_type as "followers" | "following",
    pageIndex: row.page_index,
    requestCursorHash: row.request_cursor_hash,
    nextCursorHash: row.next_cursor_hash,
    terminal: row.terminal,
    rawCount: row.raw_count,
    uniqueCount: row.unique_count,
    pageHash: row.page_hash,
    members: (row.members as unknown as ScanMember[]) || [],
    receivedAt: row.received_at,
  }));
}

/** Get the count of pages received for a job+listType */
export async function getPageCountForList(
  jobId: string,
  listType: "followers" | "following"
): Promise<number> {
  const supabase = createServerClient();
  const { count, error } = await supabase
    .from("private_scan_pages")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("list_type", listType);

  if (error) {
    console.error("Failed to count scan pages:", error);
    return 0;
  }
  return count ?? 0;
}

/** Check if at least one terminal page has been received. */
export async function hasTerminalPage(
  jobId: string,
  listType: "followers" | "following"
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("private_scan_pages")
    .select("id")
    .eq("job_id", jobId)
    .eq("list_type", listType)
    .eq("terminal", true)
    .limit(1)
    .maybeSingle();

  return !!data;
}

/** Delete all staging pages for a job (cleanup after finalization or expiry). */
export async function deletePagesForJob(jobId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("private_scan_pages")
    .delete()
    .eq("job_id", jobId);

  if (error) {
    console.error("Failed to delete scan pages:", error);
  }
}