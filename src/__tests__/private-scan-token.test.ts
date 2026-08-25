/**
 * Tests for scan token signing and verification (src/lib/private-scan/token.ts).
 *
 * Covers:
 *   - Happy path sign + verify
 *   - Payload field integrity
 *   - Expiry enforcement
 *   - Invalid/malformed tokens
 *   - Bad signatures
 *   - Missing secret
 *   - Bearer token extraction
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  signScanToken,
  verifyScanToken,
  bearerToken,
  tokenErrorResponse,
  type ScanTokenPayload,
} from "@/lib/private-scan/token";

const TEST_SECRET = "test-secret-32-bytes-for-hmac!!";

beforeAll(() => {
  process.env.PRIVATE_SCAN_TOKEN_SECRET = TEST_SECRET;
});

function makeToken(overrides: Partial<ScanTokenPayload> = {}) {
  return signScanToken(
    {
      j: overrides.j ?? "job-123",
      u: overrides.u ?? "user-abc",
      t: overrides.t ?? "target-xyz",
      l: overrides.l ?? ["followers", "following"],
      exp: overrides.exp,
      iat: overrides.iat,
    },
    { secret: TEST_SECRET }
  );
}

describe("signScanToken", () => {
  it("produces a non-empty string with dot separator", () => {
    const token = makeToken();
    expect(token).toBeTruthy();
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("produces different tokens for different job IDs", () => {
    const a = makeToken({ j: "job-a" });
    const b = makeToken({ j: "job-b" });
    expect(a).not.toBe(b);
  });

  it("produces different tokens for different users", () => {
    const a = makeToken({ u: "user-a" });
    const b = makeToken({ u: "user-b" });
    expect(a).not.toBe(b);
  });

  it("sets reasonable defaults for iat and exp", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken();
    const result = verifyScanToken(token, { secret: TEST_SECRET, now });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.iat).toBeLessThanOrEqual(now);
      // Default TTL is 30 minutes
      expect(result.payload.exp).toBeGreaterThan(now);
      expect(result.payload.exp - result.payload.iat).toBe(1800);
    }
  });
});

describe("verifyScanToken", () => {
  it("verifies a valid token", () => {
    const token = makeToken();
    const result = verifyScanToken(token, { secret: TEST_SECRET });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.j).toBe("job-123");
      expect(result.payload.u).toBe("user-abc");
      expect(result.payload.t).toBe("target-xyz");
      expect(result.payload.l).toEqual(["followers", "following"]);
    }
  });

  it("rejects null/undefined/empty tokens", () => {
    expect(verifyScanToken(null).ok).toBe(false);
    expect(verifyScanToken(undefined).ok).toBe(false);
    expect(verifyScanToken("").ok).toBe(false);
  });

  it("rejects tokens with no dot separator", () => {
    expect(verifyScanToken("just-a-string", { secret: TEST_SECRET }).ok).toBe(
      false
    );
  });

  it("rejects tokens with bad signatures", () => {
    const token = makeToken();
    // Corrupt the signature by appending a byte
    const badToken = token + "X";
    expect(
      verifyScanToken(badToken, {
        secret: TEST_SECRET,
      }).ok
    ).toBe(false);
  });

  it("rejects tokens signed with the wrong secret", () => {
    const token = signScanToken(
      { j: "j", u: "u", t: "t", l: ["followers"] },
      { secret: "wrong-secret" }
    );
    const result = verifyScanToken(token, { secret: TEST_SECRET });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad_signature");
  });

  it("rejects expired tokens", () => {
    const token = signScanToken(
      { j: "j", u: "u", t: "t", l: ["followers"], exp: 1000 },
      { secret: TEST_SECRET }
    );
    const result = verifyScanToken(token, {
      secret: TEST_SECRET,
      now: 2000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("accepts tokens exactly at expiry boundary", () => {
    const exp = 2000;
    const token = signScanToken(
      { j: "j", u: "u", t: "t", l: ["followers"], exp },
      { secret: TEST_SECRET }
    );
    // Strictly before expiry: passes
    expect(
      verifyScanToken(token, { secret: TEST_SECRET, now: exp - 1 }).ok
    ).toBe(true);
    // At expiry: fails (strict inequality)
    expect(
      verifyScanToken(token, { secret: TEST_SECRET, now: exp }).ok
    ).toBe(false);
  });

  it("rejects malformed payloads (non-JSON)", () => {
    const bad = Buffer.from("not-json").toString("base64url") + ".xxx";
    expect(verifyScanToken(bad, { secret: TEST_SECRET }).ok).toBe(false);
  });

  it("rejects tokens missing required payload fields", () => {
    const payloads = [
      { j: "x", u: "x", t: "x" }, // missing l
      { u: "x", t: "x", l: [] }, // missing j
      { j: "x", t: "x", l: [] }, // missing u
      { j: "x", u: "x", l: [] }, // missing t
      { j: 123, u: "x", t: "x", l: [] }, // j not string
      { j: "x", u: "x", t: "x", l: "not-array" }, // l not array
      { j: "x", u: "x", t: "x", l: [], exp: "not-number" }, // exp not number
    ];

    for (const p of payloads) {
      const body = Buffer.from(JSON.stringify(p)).toString("base64url");
      const sig = Buffer.from("sig").toString("base64url");
      const result = verifyScanToken(`${body}.${sig}`, {
        secret: TEST_SECRET,
      });
      expect(result.ok).toBe(false);
    }
  });

  it("preserves shortcut version field", () => {
    const token = signScanToken(
      { j: "j", u: "u", t: "t", l: ["followers"], sv: "1.2.3" },
      { secret: TEST_SECRET }
    );
    const result = verifyScanToken(token, { secret: TEST_SECRET });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.sv).toBe("1.2.3");
  });
});

describe("bearerToken", () => {
  it("extracts Bearer token from Authorization header", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "Bearer abc.def" },
    });
    expect(bearerToken(req)).toBe("abc.def");
  });

  it("returns null when no Authorization header", () => {
    const req = new Request("https://example.com");
    expect(bearerToken(req)).toBeNull();
  });

  it("returns null for non-Bearer schemes", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(bearerToken(req)).toBeNull();
  });

  it("handles leading/trailing whitespace", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "  Bearer   my.token  " },
    });
    expect(bearerToken(req)).toBe("my.token");
  });

  it("handles mixed case", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "bearer my.token" },
    });
    expect(bearerToken(req)).toBe("my.token");
  });
});

describe("tokenErrorResponse", () => {
  it("returns 401 for expired tokens", () => {
    const res = tokenErrorResponse("expired");
    expect(res.status).toBe(401);
  });

  it("returns 403 for bad signatures", () => {
    const res = tokenErrorResponse("bad_signature");
    expect(res.status).toBe(403);
  });

  it("returns 403 for malformed tokens", () => {
    const res = tokenErrorResponse("malformed");
    expect(res.status).toBe(403);
  });
});