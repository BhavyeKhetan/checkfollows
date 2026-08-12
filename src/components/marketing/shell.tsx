import Link from "next/link";
import { Zap } from "lucide-react";
import { NavBar } from "@/components/marketing/nav-bar";

const TOOL_LINKS = [
  { href: "/see-who-someone-follows", label: "See who someone follows" },
  { href: "/who-unfollowed-me", label: "Who unfollowed me" },
  { href: "/see-who-someone-unfollowed", label: "See who someone unfollowed" },
  { href: "/instagram-following-tracker", label: "Instagram following tracker" },
  { href: "/instagram-follower-tracker", label: "Instagram follower tracker" },
  { href: "/anonymous-instagram-viewer", label: "Anonymous Instagram viewer" },
];

const COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
  { href: "/pricing", label: "Pricing" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund", label: "Refund Policy" },
];

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* Header */}
      <NavBar />

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="py-14 px-4 sm:px-6 bg-[#F9F9F7] border-t border-[#E2E2DC]">
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 font-bold text-lg text-[#121212]">
                <div className="w-8 h-8 rounded-full bg-[#121212] flex items-center justify-center text-[#E7F256]">
                  <Zap className="w-4 h-4 fill-current text-[#E7F256]" />
                </div>
                <span className="tracking-tight text-xl font-extrabold">CheckFollows</span>
              </Link>
              <p className="mt-3 text-xs text-[#777777] leading-relaxed max-w-xs">
                See who any public Instagram account recently followed — anonymously,
                with no login required.
              </p>
            </div>

            <FooterCol title="Tools" links={TOOL_LINKS} />
            <FooterCol title="Company" links={COMPANY_LINKS} />
            <FooterCol title="Legal" links={LEGAL_LINKS} />
          </div>

          <div className="mt-12 pt-6 border-t border-[#E2E2DC] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#777777]">© 2026 CheckFollows. All rights reserved.</span>
            <span className="text-xs text-[#888888]">
              100% private · Zero Instagram login · Not affiliated with Instagram
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest text-[#121212] mb-4">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="text-sm text-[#555555] hover:text-[#121212] transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
