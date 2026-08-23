import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountData } from "@/lib/account-types";
import {
  clearAccountDataCache,
  refreshAccountData,
  updateAccountData,
} from "@/lib/account-data-client";
import {
  clearBillingDataCache,
  refreshBillingData,
} from "@/lib/billing-data-client";

const accountFixture: AccountData = {
  success: true,
  user: { id: "user_test", email: "test@example.com" },
  hasActiveSubscription: true,
  spikeThreshold: 5,
  credits: {
    export: 0,
    rescan_credits: 1,
    mutuals: 0,
    scan_included: 1,
    scan_purchased: 0,
    scan_weekly_allowance: 1,
    scan_refresh_at: null,
  },
  subscriptions: [],
  capacity: null,
};

afterEach(() => {
  clearAccountDataCache();
  clearBillingDataCache();
  vi.unstubAllGlobals();
});

describe("navigation data cache", () => {
  it("deduplicates account requests and reuses warm data across remounts", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(accountFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, concurrent] = await Promise.all([
      refreshAccountData(),
      refreshAccountData(),
    ]);
    const warm = await refreshAccountData();

    expect(first).toEqual(accountFixture);
    expect(concurrent).toEqual(accountFixture);
    expect(warm).toEqual(accountFixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps optimistic account changes warm until a forced refresh", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(accountFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await refreshAccountData();
    updateAccountData((current) => ({ ...current, spikeThreshold: 12 }));

    expect((await refreshAccountData()).spikeThreshold).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect((await refreshAccountData({ force: true })).spikeThreshold).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates and reuses billing requests", async () => {
    const billing = {
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
      pauseResumesAt: null,
      cadence: "weekly",
      tier: "base",
      emailAlerts: false,
      paymentMethod: null,
      retentionDiscountUsed: false,
      pauseOfferUsed: false,
      invoices: [],
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ subscription: billing }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, concurrent] = await Promise.all([
      refreshBillingData(),
      refreshBillingData(),
    ]);
    const warm = await refreshBillingData();

    expect(first).toEqual(billing);
    expect(concurrent).toEqual(billing);
    expect(warm).toEqual(billing);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
