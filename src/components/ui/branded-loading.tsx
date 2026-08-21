import { Logo } from "@/design-system";

export function BrandedLoading() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="flex flex-col items-center gap-5 animate-pulse">
        <Logo size="md" />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--badge-bg)]">
          <div className="h-full w-12 rounded-full bg-[#E7F256] animate-[ramp-marquee_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
