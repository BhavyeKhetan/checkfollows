/**
 * Tests for feature flag / kill switch (src/lib/private-scan/feature-flag.ts).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isPrivateMobileScanEnabled,
  isUserAllowedForPrivateScan,
  isAdapterVersionAccepted,
  assertPrivateScanEnabled,
  getMinAdapterVersion,
  getPrivateScanFeatureStatus,
  clearAllowlistCache,
} from "@/lib/private-scan/feature-flag";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.PRIVATE_MOBILE_SCAN_ENABLED;
  delete process.env.PRIVATE_MOBILE_BETA_ALLOWLIST;
  delete process.env.MIN_ADAPTER_VERSION;
  clearAllowlistCache();
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("isPrivateMobileScanEnabled", () => {
  it("returns false by default", () => {
    expect(isPrivateMobileScanEnabled()).toBe(false);
  });

  it("returns true when set to 'true'", () => {
    process.env.PRIVATE_MOBILE_SCAN_ENABLED = "true";
    expect(isPrivateMobileScanEnabled()).toBe(true);
  });

  it("returns false for any non-'true' value", () => {
    process.env.PRIVATE_MOBILE_SCAN_ENABLED = "1";
    expect(isPrivateMobileScanEnabled()).toBe(false);
    process.env.PRIVATE_MOBILE_SCAN_ENABLED = "yes";
    expect(isPrivateMobileScanEnabled()).toBe(false);
    process.env.PRIVATE_MOBILE_SCAN_ENABLED = "TRUE";
    expect(isPrivateMobileScanEnabled()).toBe(false);
  });
});

describe("isUserAllowedForPrivateScan", () => {
  it("allows all users when allowlist is empty", () => {
    expect(isUserAllowedForPrivateScan("any-user")).toBe(true);
    expect(isUserAllowedForPrivateScan("another")).toBe(true);
  });

  it("allows listed users when allowlist is set", () => {
    process.env.PRIVATE_MOBILE_BETA_ALLOWLIST = "user-a,user-b,user-c";
    expect(isUserAllowedForPrivateScan("user-a")).toBe(true);
    expect(isUserAllowedForPrivateScan("user-b")).toBe(true);
    expect(isUserAllowedForPrivateScan("user-c")).toBe(true);
  });

  it("denies unlisted users when allowlist is set", () => {
    process.env.PRIVATE_MOBILE_BETA_ALLOWLIST = "user-a,user-b";
    expect(isUserAllowedForPrivateScan("user-c")).toBe(false);
    expect(isUserAllowedForPrivateScan("")).toBe(false);
  });

  it("handles whitespace in allowlist", () => {
    process.env.PRIVATE_MOBILE_BETA_ALLOWLIST = " user-a ,  user-b  , user-c ";
    expect(isUserAllowedForPrivateScan("user-a")).toBe(true);
    expect(isUserAllowedForPrivateScan("user-c")).toBe(true);
  });
});

describe("isAdapterVersionAccepted", () => {
  it("accepts all versions when no minimum is set", () => {
    expect(isAdapterVersionAccepted("0.1.0")).toBe(true);
    expect(isAdapterVersionAccepted("99.99.99")).toBe(true);
    expect(isAdapterVersionAccepted("")).toBe(true);
  });

  it("rejects versions below minimum", () => {
    process.env.MIN_ADAPTER_VERSION = "2.0.0";
    expect(isAdapterVersionAccepted("1.9.9")).toBe(false);
    expect(isAdapterVersionAccepted("1.0.0")).toBe(false);
  });

  it("accepts versions equal to minimum", () => {
    process.env.MIN_ADAPTER_VERSION = "2.0.0";
    expect(isAdapterVersionAccepted("2.0.0")).toBe(true);
  });

  it("accepts versions above minimum", () => {
    process.env.MIN_ADAPTER_VERSION = "2.0.0";
    expect(isAdapterVersionAccepted("2.0.1")).toBe(true);
    expect(isAdapterVersionAccepted("3.0.0")).toBe(true);
  });

  it("handles partial version strings", () => {
    process.env.MIN_ADAPTER_VERSION = "2";
    expect(isAdapterVersionAccepted("1")).toBe(false);
    expect(isAdapterVersionAccepted("2")).toBe(true);
    expect(isAdapterVersionAccepted("2.5")).toBe(true);
    expect(isAdapterVersionAccepted("3")).toBe(true);
  });
});

describe("assertPrivateScanEnabled", () => {
  it("throws 503 when feature is disabled", () => {
    let response: Response | null = null;
    try {
      assertPrivateScanEnabled();
    } catch (e) {
      response = e as Response;
    }
    expect(response).toBeInstanceOf(Response);
    expect(response!.status).toBe(503);
  });

  it("throws 403 when user is not in beta allowlist", () => {
    process.env.PRIVATE_MOBILE_SCAN_ENABLED = "true";
    process.env.PRIVATE_MOBILE_BETA_ALLOWLIST = "only-me";

    let response: Response | null = null;
    try {
      assertPrivateScanEnabled("someone-else");
    } catch (e) {
      response = e as Response;
    }
    expect(response).toBeInstanceOf(Response);
    expect(response!.status).toBe(403);
  });

  it("does not throw when feature is enabled and user is allowed", () => {
    process.env.PRIVATE_MOBILE_SCAN_ENABLED = "true";

    // Should not throw
    assertPrivateScanEnabled();
    assertPrivateScanEnabled("any-user");
  });

  it("throws 400 when adapter version is too old", () => {
    process.env.PRIVATE_MOBILE_SCAN_ENABLED = "true";
    process.env.MIN_ADAPTER_VERSION = "2.0.0";

    let response: Response | null = null;
    try {
      assertPrivateScanEnabled(undefined, "1.0.0");
    } catch (e) {
      response = e as Response;
    }
    expect(response).toBeInstanceOf(Response);
    expect(response!.status).toBe(400);
  });
});

describe("getMinAdapterVersion", () => {
  it("returns 'none' when not set", () => {
    expect(getMinAdapterVersion()).toBe("none");
  });

  it("returns the set value", () => {
    process.env.MIN_ADAPTER_VERSION = "1.5.0";
    expect(getMinAdapterVersion()).toBe("1.5.0");
  });
});

describe("getPrivateScanFeatureStatus", () => {
  it("reports disabled + no beta by default", () => {
    const status = getPrivateScanFeatureStatus();
    expect(status.enabled).toBe(false);
    expect(status.betaMode).toBe(false);
    expect(status.minAdapterVersion).toBe("none");
  });

  it("reports beta mode when allowlist is set", () => {
    process.env.PRIVATE_MOBILE_SCAN_ENABLED = "true";
    process.env.PRIVATE_MOBILE_BETA_ALLOWLIST = "user-1,user-2";
    process.env.MIN_ADAPTER_VERSION = "2.0.0";

    const status = getPrivateScanFeatureStatus();
    expect(status.enabled).toBe(true);
    expect(status.betaMode).toBe(true);
    expect(status.minAdapterVersion).toBe("2.0.0");
  });
});