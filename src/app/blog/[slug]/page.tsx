import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, CheckCircle2 } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { getPost, BLOG_POSTS } from "@/lib/blog-posts";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — CheckFollows`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <MarketingShell>
      <article className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#555555] hover:text-[#121212] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> All articles
          </Link>

          <div className="flex items-center gap-3 text-xs font-semibold text-[#888888] mb-4">
            <span className="rounded-full bg-[#EDEDE8] px-2.5 py-0.5 text-[#121212] font-mono">
              {post.category}
            </span>
            <span>{post.date}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {post.readTime}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#121212] leading-[1.15]">
            {post.title}
          </h1>

          <div className="mt-10 space-y-10">
            {post.sections.map((section, i) => (
              <div key={i}>
                {section.heading && (
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#121212] tracking-tight mb-3">
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs?.map((p, j) => (
                  <p
                    key={j}
                    className="text-[15px] sm:text-base leading-relaxed text-[#555555] mb-3"
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

          {/* CTA */}
          <div className="mt-14 rounded-2xl border-2 border-[#E7F256] bg-[#FFFFFF] shadow-[0_4px_20px_rgba(231,242,86,0.25)] p-6 sm:p-8 text-center">
            <h2 className="text-xl font-extrabold text-[#121212]">
              Ready to see who they recently followed?
            </h2>
            <p className="text-sm text-[#555555] mt-2 max-w-sm mx-auto">
              Search any public Instagram handle — free preview, no login required.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center justify-center font-semibold rounded-full text-sm px-6 py-3 gap-2 bg-[#E7F256] text-[#121212] hover:bg-[#DAE64A] active:bg-[#C7D337] border border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200"
            >
              Check followers anonymously
            </Link>
          </div>
        </div>
      </article>
    </MarketingShell>
  );
}
