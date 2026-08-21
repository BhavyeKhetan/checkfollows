import { AppShell } from "@/components/app/app-shell";

export function DashboardSkeleton() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6 sm:py-10 animate-pulse">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-8 w-52 rounded-xl bg-[var(--badge-bg)]" />
          <div className="h-4 w-96 max-w-full rounded-lg bg-[var(--badge-bg)]/80" />
        </div>

        {/* Capacity banner */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-4 w-44 rounded-lg bg-[var(--badge-bg)]" />
            <div className="h-3 w-32 rounded-lg bg-[var(--badge-bg)]/80" />
          </div>
        </div>

        {/* Section title & count */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 rounded-lg bg-[var(--badge-bg)]" />
            <div className="h-4 w-20 rounded-lg bg-[var(--badge-bg)]/80" />
          </div>

          {/* Account cards */}
          {[1, 2].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-[var(--badge-bg)] shrink-0" />
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-28 sm:w-36 rounded-md bg-[var(--badge-bg)]" />
                    <div className="h-5 w-20 rounded-full bg-[var(--badge-bg)]/70" />
                  </div>
                  <div className="h-3 w-40 sm:w-52 rounded-md bg-[var(--badge-bg)]/60" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t border-[var(--border)] sm:border-0 w-full sm:w-auto">
                <div className="h-9 flex-1 sm:w-20 rounded-xl bg-[var(--badge-bg)]" />
                <div className="h-9 flex-1 sm:w-20 rounded-xl bg-[var(--badge-bg)]" />
              </div>
            </div>
          ))}
        </div>

        {/* Value props skeleton */}
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-md bg-[var(--badge-bg)] shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-24 rounded bg-[var(--badge-bg)]" />
                <div className="h-3 w-full rounded bg-[var(--badge-bg)]/60" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
