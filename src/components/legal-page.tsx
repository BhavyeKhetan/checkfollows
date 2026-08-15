import Link from "next/link";
import { Logo } from "@/design-system";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-[#121212] tracking-tight mb-3">
        {title}
      </h2>
      <div className="text-[15px] leading-relaxed text-[#555555] space-y-3">
        {children}
      </div>
    </section>
  );
}

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* Header */}
      <nav className="sticky top-0 z-50 ramp-glass">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-sm font-semibold text-[#555555] hover:text-[#121212] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#888888]">
          CheckFollows
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
          {title}
        </h1>
        {updated && (
          <p className="mt-3 text-sm text-[#777777]">Last updated: {updated}</p>
        )}
        <div className="mt-10 space-y-10">{children}</div>
      </main>

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-6 bg-[#FFFFFF] border-t border-[#E2E2DC]">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-[#777777]">
            <span>© 2026 CheckFollows</span>
            <span className="hidden sm:inline">·</span>
            <Link
              href="/privacy"
              className="hover:text-[#121212] transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link
              href="/terms"
              className="hover:text-[#121212] transition-colors"
            >
              Terms of Service
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link
              href="/refund"
              className="hover:text-[#121212] transition-colors"
            >
              Refund Policy
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link
              href="/contact"
              className="hover:text-[#121212] transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
