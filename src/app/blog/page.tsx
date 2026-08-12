import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Blog — CheckFollows",
  description:
    "Guides on Instagram following, follower tracking, privacy, and how to see who someone recently followed.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return (
    <MarketingShell>
      <section className="relative ramp-grid-bg pt-14 pb-16 sm:pt-20 sm:pb-20 px-4 sm:px-6 border-b border-[#E2E2DC]">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#121212] leading-[1.08]">
            The CheckFollows blog
          </h1>
          <p className="mt-5 text-base sm:text-lg text-[#555555] max-w-xl mx-auto leading-relaxed font-medium">
            Guides on Instagram tracking, privacy, and reading the signals hidden
            in who people follow.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#FFFFFF]">
        <div className="max-w-3xl mx-auto space-y-6">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-[#E2E2DC] bg-[#FFFFFF] p-6 sm:p-7 transition-all duration-200 hover:border-[#D0D0CA] hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)]"
            >
              <div className="flex items-center gap-3 text-xs font-semibold text-[#888888] mb-3">
                <span className="rounded-full bg-[#EDEDE8] px-2.5 py-0.5 text-[#121212] font-mono">
                  {post.category}
                </span>
                <span>{post.date}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {post.readTime}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#121212] tracking-tight group-hover:underline underline-offset-4">
                {post.title}
              </h2>
              <p className="mt-2 text-sm text-[#555555] leading-relaxed">
                {post.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#121212]">
                Read article
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
