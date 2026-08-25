/**
 * Private mobile scan feature flag & kill switch (§26 of the plan).
 *
 * Centralized control for enabling/disabling private mobile scanning.
 * Call this before creating jobs, accepting uploads, or serving routes.
 *
 * Environment variables:
 *   PRIVATE_MOBILE_SCAN_ENABLED  — "true" to enable, anything else = disabled
 *   PRIVATE_MOBILE_BETA_ALLOWLIST — comma-separated user IDs (empty = open to all paid users)
 *   MIN_ADAPTER_VERSION          — minimum accepted Shortcut adapter version (semver)
 */

// ─── Feature flag ──────────────────────────────────────────

/** Whether private mobile scanning is globally enabled. Default: false (safe). */
export function isPrivateMobileScanEnabled(): boolean {
  return process.env.PRIVATE_MOBILE_SCAN_ENABLED === "true";
}

// ─── Beta allowlist ────────────────────────────────────────

let _allowlistCache: Set<string> | null = null;
let _allowlistTtl = 0;

function getAllowlist(): Set<string> {
  const now = Date.now();
  if (_allowlistCache && now < _allowlistTtl) return _allowlistCache;

  const raw = process.env.PRIVATE_MOBILE_BETA_ALLOWLIST || "";
  _allowlistCache = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  _allowlistTtl = now + 60_000; // 1 min cache
  return _allowlistCache;
}

/**
 * Check if a user is allowed to use private mobile scanning.
 * - If the allowlist is empty, all paid users are allowed.
 * - If the allowlist is set, only listed user IDs are allowed.
 */
export function isUserAllowedForPrivateScan(userId: string): boolean {
  const allowlist = getAllowlist();
  if (allowlist.size === 0) return true; // Open beta
  return allowlist.has(userId);
}

// ─── Adapter version gating ────────────────────────────────

/**
 * Parse a semver-ish version string into comparable numbers.
 * Handles "1", "1.2", "1.2.3". Returns [major, minor, patch].
 */
function parseVersion(version: string): number[] {
  return version
    .split(".")
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n));
}

/**
 * Compare two version arrays. Returns:
 *   -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

/** Minimum Shortcut adapter version required (read from env each call for testability). */
function getMinAdapterVersionEnv(): string {
  return process.env.MIN_ADAPTER_VERSION || "";
}

/**
 * Check whether a given adapter version meets the minimum.
 * If no minimum is set, all versions are accepted.
 */
export function isAdapterVersionAccepted(adapterVersion: string): boolean {
  const minVersion = getMinAdapterVersionEnv();
  if (!minVersion) return true;
  return (
    compareVersions(
      parseVersion(adapterVersion),
      parseVersion(minVersion)
    ) >= 0
  );
}

/** Get the current minimum adapter version for logging / status endpoints. */
export function getMinAdapterVersion(): string {
  return getMinAdapterVersionEnv() || "none";
}

/** Clear the cached allowlist (for tests). */
export function clearAllowlistCache(): void {
  _allowlistCache = null;
  _allowlistTtl = 0;
}

/**
 * Central guard: call at the top of every private-scan API route.
 * Throws a Response if the feature is disabled, the user is not
 * allowed, or the adapter version is too old.
 * Does NOT throw for non-rejection codepaths.
 */
export function assertPrivateScanEnabled(
  userId?: string,
  adapterVersion?: string
): void {
  if (!isPrivateMobileScanEnabled()) {
    throw Response.json(
      {
        success: false,
        errorCode: "SERVER_VALIDATION_FAILED",
        error:
          "Private mobile scanning is currently unavailable. Your previous scan data is preserved.",
      },
      { status: 503 }
    );
  }

  if (userId && !isUserAllowedForPrivateScan(userId)) {
    throw Response.json(
      {
        success: false,
        errorCode: "SERVER_VALIDATION_FAILED",
        error:
          "Private mobile scanning is in limited beta. You'll be notified when it's available.",
      },
      { status: 403 }
    );
  }

  if (adapterVersion && !isAdapterVersionAccepted(adapterVersion)) {
    throw Response.json(
      {
        success: false,
        errorCode: "SERVER_VALIDATION_FAILED",
        error:
          "Your Shortcut is outdated. Please update to the latest version to continue scanning.",
      },
      { status: 400 }
    );
  }
}

// ─── Status endpoint helper ────────────────────────────────

export interface PrivateScanFeatureStatus {
  enabled: boolean;
  betaMode: boolean;
  minAdapterVersion: string;
}

export function getPrivateScanFeatureStatus(): PrivateScanFeatureStatus {
  const allowlist = getAllowlist();
  return {
    enabled: isPrivateMobileScanEnabled(),
    betaMode: allowlist.size > 0,
    minAdapterVersion: getMinAdapterVersion(),
  };
}