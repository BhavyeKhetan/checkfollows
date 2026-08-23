"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { AccountData } from "@/lib/account-types";

const FRESH_FOR_MS = 60_000;

interface AccountDataSnapshot {
  data: AccountData | null;
  error: AccountDataRequestError | null;
  loading: boolean;
  updatedAt: number;
}

const EMPTY_SNAPSHOT: AccountDataSnapshot = {
  data: null,
  error: null,
  loading: true,
  updatedAt: 0,
};

let snapshot: AccountDataSnapshot = EMPTY_SNAPSHOT;
let inFlight: Promise<AccountData> | null = null;
let generation = 0;
const listeners = new Set<() => void>();

export class AccountDataRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AccountDataRequestError";
  }
}

function emit(next: AccountDataSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

function isFresh() {
  return !!snapshot.data && Date.now() - snapshot.updatedAt < FRESH_FOR_MS;
}

export async function refreshAccountData(options?: {
  force?: boolean;
}): Promise<AccountData> {
  if (!options?.force && isFresh() && snapshot.data) return snapshot.data;
  if (inFlight) return inFlight;

  if (!snapshot.data) emit({ ...snapshot, loading: true, error: null });
  const requestGeneration = generation;

  const request = (async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      throw new AccountDataRequestError(
        json.error || "Failed to load account",
        response.status
      );
    }
    const data = json as AccountData;
    if (requestGeneration === generation) {
      emit({ data, error: null, loading: false, updatedAt: Date.now() });
    }
    return data;
  })()
    .catch((error: unknown) => {
      const normalized =
        error instanceof AccountDataRequestError
          ? error
          : new AccountDataRequestError("Network error", 0);
      if (requestGeneration === generation) {
        emit({ ...snapshot, error: normalized, loading: false });
      }
      throw normalized;
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

export function prefetchAccountData() {
  void refreshAccountData().catch(() => {
    // Pages surface the error if the user navigates there.
  });
}

export function updateAccountData(
  updater: (current: AccountData) => AccountData
) {
  if (!snapshot.data) return;
  emit({ ...snapshot, data: updater(snapshot.data), updatedAt: Date.now() });
}

export function clearAccountDataCache() {
  generation += 1;
  inFlight = null;
  emit(EMPTY_SNAPSHOT);
}

export function useAccountData() {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    if (!current.data || !isFresh()) prefetchAccountData();
  }, [current.data]);

  const refresh = useCallback(
    (force = true) => refreshAccountData({ force }),
    []
  );

  return {
    ...current,
    refresh,
    update: updateAccountData,
  };
}
