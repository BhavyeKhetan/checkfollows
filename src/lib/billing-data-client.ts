"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const FRESH_FOR_MS = 5 * 60_000;

export interface BillingData {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  pauseResumesAt: string | null;
  cadence: "weekly" | "quarterly";
  tier: "base" | "premium";
  emailAlerts: boolean;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  retentionDiscountUsed: boolean;
  pauseOfferUsed: boolean;
  invoices: Array<{
    id: string;
    createdAt: string;
    amountPaid: number;
    currency: string;
    status: string | null;
    url: string | null;
  }>;
}

interface BillingSnapshot {
  data: BillingData | null;
  error: string;
  loading: boolean;
  updatedAt: number;
}

const EMPTY_SNAPSHOT: BillingSnapshot = {
  data: null,
  error: "",
  loading: true,
  updatedAt: 0,
};

let snapshot: BillingSnapshot = EMPTY_SNAPSHOT;
let inFlight: Promise<BillingData | null> | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function emit(next: BillingSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isFresh() {
  return Date.now() - snapshot.updatedAt < FRESH_FOR_MS;
}

export async function refreshBillingData(force = false) {
  if (!force && isFresh()) return snapshot.data;
  if (inFlight) return inFlight;
  if (!snapshot.data) emit({ ...snapshot, loading: true, error: "" });
  const requestGeneration = generation;

  const request = (async () => {
    const response = await fetch("/api/account/billing", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.error || "Billing details could not be loaded.");
    }
    const data = (json.subscription || null) as BillingData | null;
    if (requestGeneration === generation) {
      emit({ data, error: "", loading: false, updatedAt: Date.now() });
    }
    return data;
  })()
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Billing details could not be loaded.";
      if (requestGeneration === generation) {
        emit({ ...snapshot, error: message, loading: false });
      }
      throw error;
    });

  inFlight = request;
  void request.then(
    () => {
      if (inFlight === request) inFlight = null;
    },
    () => {
      if (inFlight === request) inFlight = null;
    }
  );

  return request;
}

export function prefetchBillingData() {
  void refreshBillingData().catch(() => {
    // The billing section surfaces this error when opened.
  });
}

export function clearBillingDataCache() {
  generation += 1;
  inFlight = null;
  emit(EMPTY_SNAPSHOT);
}

export function useBillingData() {
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY_SNAPSHOT
  );

  useEffect(() => {
    if (!current.data || !isFresh()) prefetchBillingData();
  }, [current.data]);

  return {
    ...current,
    refresh: useCallback((force = true) => refreshBillingData(force), []),
  };
}
