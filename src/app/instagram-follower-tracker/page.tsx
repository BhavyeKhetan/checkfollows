import type { Metadata } from "next";
import { Users, TrendingUp, Bell, History, Shield, Eye } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "Instagram Follower Tracker — CheckFollows",
  description:
    "Track follower growth and lost followers on any public Instagram account. Every-other-day monitoring, change alerts, and a full history. No login required.",
  alternates: { canonical: "/instagram-follower-tracker" },
};

export default function Page() {
  return (
    <MarketingShell>
      <SeoPage
        badge="INSTAGRAM FOLLOWER TRACKER"
        title={
          <>
            Instagram{" "}
            <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">
              follower tracker
            </span>
          </>
        }
        subtitle="Watch any public account's follower count rise and fall. See new followers, lost followers, and growth trends — automatically, every day."
        placeholder="Enter a handle to track... (e.g. alex)"
        intro={[
          "Follower counts only tell you where an account stands right now. A follower tracker tells you the story: who's coming, who's going, and how fast.",
          "CheckFollows records follower snapshots over time for any public Instagram account, so you can see growth spikes, drops, and the exact people behind them.",
        ]}
        sections={[
          {
            heading: "What a follower tracker shows you",
            paragraphs: [
              "Beyond the raw number, a good follower tracker reveals the individuals behind every change — which is what actually matters for creators, brands, and curious users alike.",
            ],
            bullets: [
              "New followers as they arrive",
              "Lost followers and when they left",
              "Growth rate and trends over time",
              "Chronological follower history",
            ],
          },
          {
            heading: "Built for creators and brands",
            paragraphs: [
              "If you run an account, follower churn is your report card. Track which content brings people in and what pushes them away — then double down on what works.",
            ],
            bullets: [
              "Measure the impact of new posts and campaigns",
              "Spot suspicious mass-unfollow events",
              "Benchmark growth against competitors",
              "Keep an audit trail of your audience",
            ],
          },
        ]}
        features={[
          { icon: Users, title: "New follower alerts", body: "Know the moment someone new follows." },
          { icon: TrendingUp, title: "Growth analytics", body: "See trends and spikes over time." },
          { icon: Bell, title: "Change notifications", body: "Email alerts on meaningful changes." },
          { icon: History, title: "Permanent history", body: "Every follower change, saved and dated." },
          { icon: Shield, title: "No password", body: "No Instagram login required." },
          { icon: Eye, title: "Fully anonymous", body: "The account owner is never notified." },
        ]}
        faqs={[
          {
            q: "How does an Instagram follower tracker work?",
            a: "It periodically records a public account's follower list and diffs snapshots to surface new followers and lost followers over time.",
          },
          {
            q: "Can I track my own followers?",
            a: "Yes. Enter your own public handle to monitor your follower growth and see exactly who unfollowed you.",
          },
          {
            q: "Does it work for private accounts?",
            a: "No. We only support public Instagram accounts.",
          },
          {
            q: "How often is data refreshed?",
            a: "Paid plans refresh automatically every 48 hours.",
          },
          {
            q: "Is it safe?",
            a: "Yes. We never ask for your Instagram credentials and only read public data.",
          },
        ]}
        related={[
          { href: "/see-who-someone-follows", label: "See who someone follows" },
          { href: "/who-unfollowed-me", label: "Who unfollowed me" },
          { href: "/see-who-someone-unfollowed", label: "See who someone unfollowed" },
          { href: "/instagram-following-tracker", label: "Instagram following tracker" },
          { href: "/anonymous-instagram-viewer", label: "Anonymous Instagram viewer" },
        ]}
      />
    </MarketingShell>
  );
}
