/**
 * Private mobile scan API contracts (§9, §8, §7 of the plan).
 *
 * These types are shared between the Next.js API routes and any
 * client-side code that talks to /api/private-scan/*.
 */

// ─── Member (single Instagram user in a page) ──────────────

export interface ScanMember {
  instagramId: string;
  username: string;
  fullName?: string | null;
  isVerified?: boolean;
  avatarUrl?: string | null;
}

// ─── Start job ─────────────────────────────────────────────

export interface StartScanRequest {
  targetId: string;
  requestedLists?: ("followers" | "following")[];
}

export interface StartScanResponse {
  jobId: string;
  scanToken: string;
  targetUsername: string;
  targetInstagramId: string;
  expiresAt: string;
  instagramUrl: string;
  requestedLists: string[];
}

// ─── Bootstrap handshake ───────────────────────────────────

export interface BootstrapRequest {
  /** window.location.hostname */
  hostname: string;
  /** Instagram numeric user id of the logged-in viewer (best effort) */
  viewerInstagramId?: string | null;
  /** Viewer's Instagram username (best effort) */
  viewerUsername?: string | null;
  /** Shortcut version running on the device */
  shortcutVersion?: string | null;
  /** Adapter version (Instagram schema/endpoint version) */
  adapterVersion?: string | null;
}

export interface BootstrapResponse {
  ok: boolean;
  permittedLists: string[];
  /** Server-truth numeric Instagram id of the scan target (drives the REST fetches) */
  targetInstagramId: string;
  /** Server-truth Instagram username of the scan target */
  targetUsername: string;
  viewerRecorded: boolean;
}

// ─── Page upload ───────────────────────────────────────────

export interface PageUploadRequest {
  listType: "followers" | "following";
  pageIndex: number;
  /** Cursor used to request this page (null for first page) */
  requestCursor?: string | null;
  /** Cursor received for the next page (null for terminal) */
  nextCursor?: string | null;
  /** True if this is the last page */
  terminal: boolean;
  members: ScanMember[];
  responseEvidence?: {
    rawCount?: number;
    sourceStatus?: number;
    schemaVersion?: string;
  };
}

export interface PageUploadResponse {
  accepted: boolean;
  pageIndex: number;
  errorCode?: string;
}

// ─── Finalize list ─────────────────────────────────────────

export interface FinalizeListRequest {
  listType: "followers" | "following";
  /** Profile count observed before scan started */
  preCount?: number;
  /** Profile count observed after scan completed */
  postCount?: number;
}

export interface FinalizeListResponse {
  listComplete: boolean;
  memberCount: number;
  snapshotId?: string;
  isBaseline: boolean;
  newEventCount: number;
  lostEventCount: number;
}

// ─── Finalize job ──────────────────────────────────────────

export interface FinalizeResponse {
  success: boolean;
  snapshotCount: number;
  totalEventCount: number;
  resultsUrl: string;
  isBaseline: boolean;
}

// ─── Job status (polling) ──────────────────────────────────

export interface JobStatusResponse {
  id: string;
  status: "open" | "completed" | "failed" | "expired";
  targetId: string;
  targetUsername: string;
  requestedLists: string[];
  startedAt: string;
  completedAt: string | null;
  expiresAt: string;
  errorCode: string | null;
  errorDetailSafe: string | null;
  hasEvents: boolean;
  eventCount: number;
}

// ─── Private scan result (for the track page) ──────────────

export interface PrivateScanResult {
  lastScanAt: string | null;
  lastScanJobId: string | null;
  lastScanStatus: "completed" | "failed" | null;
  hasBaseline: boolean;
  followerSnapshotMemberCount: number;
  followingSnapshotMemberCount: number;
}