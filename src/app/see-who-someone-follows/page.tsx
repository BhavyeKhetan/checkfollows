import type { Metadata } from "next";
import { Eye, Heart, TrendingUp, Briefcase, Bell, History } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "See Who Someone Recently Followed on Instagram — CheckFollows",
  description:
    "See who any public Instagram account recently followed in true chronological order. No login, fully anonymous, results in seconds.",
  alternates: { canonical: "/see-who-someone-follows" },
};

export default function Page() {
  return (
    <MarketingShell>
      <SeoPage
        badge="SEE WHO SOMEONE FOLLOWS"
        title={
          <>
            See who someone{" "}
            <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">
              recently followed
            </span>
          </>
        }
        subtitle="Instagram scrambles the order of every following list. CheckFollows reveals the true, chronological order — newest follow first — without logging in."
        placeholder="Enter any public handle... (e.g. yourcrush)"
        intro={[
          "When you open someone's following list inside the Instagram app, the order you see is not real. Instagram quietly sorts accounts by mutual connections and secret algorithm weights, burying the people they followed most recently at the bottom.",
          "CheckFollows bypasses that ordering and shows you the actual sequence: who they followed today, who they followed last week, and who quietly disappeared from the list. All you need is a public username.",
        ]}
        sections={[
          {
            heading: "Why the in-app list is misleading",
            paragraphs: [
              "Instagram's native following list puts mutual friends and accounts it thinks you'll engage with at the top. That means the newest follow is rarely where you'd expect it — and you can easily miss a meaningful new connection.",
            ],
            bullets: [
              "Newest follows are not shown first inside the app",
              "Mutual connections are prioritized over recency",
              "Unfollows are invisible until you compare snapshots",
              "There's no way to see history from inside the app",
            ],
          },
          {
            heading: "What you'll see with CheckFollows",
            paragraphs: [
              "Enter a handle and we return the full following list in true chronological order, with the most recent follows at the top. A free preview shows the profile and its counts instantly; unlocking reveals the complete ordered list and every-other-day change monitoring.",
            ],
            bullets: [
              "Exact order — newest follow first",
              "Clear new-follow and unfollow markers",
              "A timeline of changes over time",
              "Automatic alerts when something changes",
            ],
          },
        ]}
        features={[
          { icon: Eye, title: "Truly anonymous", body: "No login, no cookies, no trace. The person you search is never notified." },
          { icon: Heart, title: "Relationship clarity", body: "Spot new social connections before they become a surprise." },
          { icon: TrendingUp, title: "Creator intelligence", body: "See which brands and accounts an influencer is networking with." },
          { icon: Briefcase, title: "Competitor insight", body: "Track the strategic follows of rivals, recruiters, and founders." },
          { icon: Bell, title: "Change alerts", body: "Get notified the moment a new follow is detected." },
          { icon: History, title: "Permanent history", body: "Every scan builds a timeline you can revisit anytime." },
        ]}
        faqs={[
          {
            q: "Can I see who someone follows without them knowing?",
            a: "Yes. CheckFollows reads only public data and never interacts with Instagram on your behalf, so the account owner is never alerted.",
          },
          {
            q: "Does it work for private accounts?",
            a: "No. CheckFollows only works with public Instagram accounts. If an account is private, we'll tell you immediately.",
          },
          {
            q: "Is the following order really chronological?",
            a: "Yes. We sort by the actual sequence of follows, not Instagram's scrambled algorithm view, so the newest follows appear first.",
          },
          {
            q: "Do I need to log into Instagram?",
            a: "No. You never enter your Instagram credentials. We only access public data.",
          },
          {
            q: "How much does it cost?",
            a: "Search and preview are free. Full access starts at $9.99/week — cancel anytime.",
          },
        ]}
        related={[
          { href: "/who-unfollowed-me", label: "Who unfollowed me" },
          { href: "/see-who-someone-unfollowed", label: "See who someone unfollowed" },
          { href: "/instagram-following-tracker", label: "Instagram following tracker" },
          { href: "/instagram-follower-tracker", label: "Instagram follower tracker" },
          { href: "/anonymous-instagram-viewer", label: "Anonymous Instagram viewer" },
        ]}
      />
    </MarketingShell>
  );
}
