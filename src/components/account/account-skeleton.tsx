import { AppShell } from "@/components/app/app-shell";

export function AccountSkeleton() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6 sm:py-10 animate-pulse">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-5 w-32 rounded-full bg-[var(--badge-bg)]" />
          <div className="h-8 w-60 rounded-xl bg-[var(--badge-bg)]" />
          <div className="h-4 w-80 max-w-full rounded-lg bg-[var(--badge-bg)]/80" />
        </div>

        {/* Subscription status card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="h-11 w-11 rounded-xl bg-[var(--badge-bg)] shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-44 rounded bg-[var(--badge-bg)]" />
                <div className="h-3 w-64 max-w-full rounded bg-[var(--badge-bg)]/80" />
              </div>
            </div>
            <div className="h-10 w-36 rounded-xl bg-[var(--badge-bg)] shrink-0" />
          </div>
        </div>

        {/* Slots capacity & spike alerts */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-[var(--badge-bg)] shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-48 rounded bg-[var(--badge-bg)]" />
              <div className="h-3 w-72 max-w-full rounded bg-[var(--badge-bg)]/80" />
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
