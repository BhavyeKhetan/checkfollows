import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, CheckCircle2 } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { getPost, BLOG_POSTS, formatCategory } from "@/lib/blog-posts";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://checkfollows.vercel.app";

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
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${BASE_URL}/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
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

  const related = (post.relatedSlugs || [])
    .map((slug) => getPost(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

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
              {formatCategory(post.category)}
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

          {/* FAQ */}
          {post.faq && post.faq.length > 0 && (
            <div className="mt-14">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#121212] tracking-tight mb-4">
                Frequently asked questions
              </h2>
              <div className="space-y-3">
                {post.faq.map((item, i) => (
                  <details
                    key={i}
                    className="group rounded-2xl border border-[#E2E2DC] bg-[#FFFFFF] px-5 py-4 transition-colors open:border-[#D0D0CA]"
                  >
                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4 text-[15px] font-bold text-[#121212]">
                      <span>{item.question}</span>
                      <span className="text-[#888888] text-lg leading-none mt-0.5 group-open:hidden">
                        +
                      </span>
                      <span className="text-[#888888] text-lg leading-none mt-0.5 hidden group-open:inline">
                        −
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-[#555555]">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          )}

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

          {/* Related posts */}
          {related.length > 0 && (
            <div className="mt-14">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#121212] tracking-tight mb-5">
                Keep reading
              </h2>
              <div className="space-y-4">
                {related.map((relatedPost) => (
                  <Link
                    key={relatedPost.slug}
                    href={`/blog/${relatedPost.slug}`}
                    className="group block rounded-2xl border border-[#E2E2DC] bg-[#FFFFFF] p-5 transition-all duration-200 hover:border-[#D0D0CA] hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)]"
                  >
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-[#888888] mb-2">
                      <span className="rounded-full bg-[#EDEDE8] px-2.5 py-0.5 text-[#121212] font-mono">
                        {formatCategory(relatedPost.category)}
                      </span>
                      <span>{relatedPost.readTime}</span>
                    </div>
                    <span className="block text-base font-extrabold text-[#121212] group-hover:underline underline-offset-4">
                      {relatedPost.title}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#121212]">
                      Read article
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </MarketingShell>
  );
}
