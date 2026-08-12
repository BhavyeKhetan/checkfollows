import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Shield, Lock, Eye, ArrowRight } from "lucide-react";
import { Badge, Card } from "@/design-system";
import { SearchBox } from "@/components/marketing/search-box";
import { FaqList } from "@/components/marketing/faq-list";

export type SeoSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type SeoFeature = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const TRUST_BADGES = [
  { icon: Shield, label: "100% Private & Untraceable" },
  { icon: Lock, label: "Zero IG Password Needed" },
  { icon: Eye, label: "Target Is Never Alerted" },
];

export function SeoPage({
  badge,
  title,
  subtitle,
  placeholder,
  intro,
  sections = [],
  features = [],
  faqs,
  related,
}: {
  badge: string;
  title: React.ReactNode;
  subtitle: string;
  placeholder?: string;
  intro?: string[];
  sections?: SeoSection[];
  features?: SeoFeature[];
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
}) {
  return (
    <div>
      {/* Hero */}
      <section className="relative ramp-grid-bg pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 border-b border-[#E2E2DC]">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          <Badge variant="mono" size="md" className="mb-6">
            {badge}
          </Badge>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#121212] leading-[1.08] max-w-3xl mx-auto text-center">
            {title}
          </h1>
          <p className="mt-6 text-base sm:text-lg text-[#555555] max-w-xl mx-auto leading-relaxed font-medium">
            {subtitle}
          </p>
          <div className="mt-8 w-full">
            <SearchBox placeholder={placeholder} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-[#555555]">
            {TRUST_BADGES.map((b) => (
              <span key={b.label} className="flex items-center gap-1">
                <b.icon className="w-3.5 h-3.5 text-[#047857]" /> {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Intro / content sections */}
      {(intro || sections.length > 0) && (
        <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#FFFFFF]">
          <div className="max-w-3xl mx-auto">
            {intro?.map((p, i) => (
              <p
                key={i}
                className="text-[15px] sm:text-base leading-relaxed text-[#555555] mb-4"
              >
                {p}
              </p>
            ))}

            <div className="mt-10 space-y-12">
              {sections.map((section, i) => (
                <div key={i}>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#121212] tracking-tight mb-4">
                    {section.heading}
                  </h2>
                  {section.paragraphs?.map((p, j) => (
                    <p
                      key={j}
                      className="text-[15px] leading-relaxed text-[#555555] mb-3"
                    >
                      {p}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul className="space-y-2.5 mt-4">
                      {section.bullets.map((b, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-[15px] text-[#555555]">
                          <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Feature grid */}
      {features.length > 0 && (
        <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#F9F9F7] border-y border-[#E2E2DC]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#121212] tracking-tight text-center mb-12">
              Everything you get with CheckFollows
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {features.map((f) => (
                <Card key={f.title} hoverable className="bg-[#FFFFFF]">
                  <div className="w-10 h-10 rounded-xl bg-[#E7F256] border border-black/10 flex items-center justify-center mb-3 text-[#121212]">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-base text-[#121212] mb-1">{f.title}</h3>
                  <p className="text-xs text-[#555555] leading-relaxed">{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#FFFFFF]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#121212] tracking-tight text-center mb-10">
            Frequently asked questions
          </h2>
          <FaqList faqs={faqs} />
        </div>
      </section>

      {/* Related pages (interlinking) */}
      {related.length > 0 && (
        <section className="py-14 px-4 sm:px-6 bg-[#F9F9F7] border-t border-[#E2E2DC]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#888888] text-center mb-6">
              More tools
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {related.map((r) => (
                <Link
                  key={r.href + r.label}
                  href={r.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E2DC] bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-[#555555] hover:text-[#121212] hover:border-[#D0D0CA] transition-colors"
                >
                  {r.label}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#FFFFFF] border-t border-[#E2E2DC]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#121212] tracking-tight mb-3">
            Ready to see who they recently followed?
          </h2>
          <p className="text-[#555555] mb-6 text-base max-w-md mx-auto font-medium">
            Search any public Instagram handle above — free preview, no login required.
          </p>
          <div className="flex flex-col items-center justify-center gap-2">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#121212] underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              See pricing <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
