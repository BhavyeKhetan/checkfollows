import type { Metadata } from "next";
import { UserPlus, Eye, Bell, History, Shield, TrendingUp } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "Instagram Following Tracker — CheckFollows",
  description:
    "Track who any Instagram account follows with daily automatic monitoring. See new follows and unfollows in a clear timeline. No login required.",
  alternates: { canonical: "/instagram-following-tracker" },
};

export default function Page() {
  return (
    <MarketingShell>
      <SeoPage
        badge="INSTAGRAM FOLLOWING TRACKER"
        title={
          <>
            Instagram{" "}
            <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">
              following tracker
            </span>
          </>
        }
        subtitle="Monitor any public Instagram account's following list automatically. See every new follow and unfollow as it happens, without lifting a finger."
        placeholder="Enter a handle to track... (e.g. alex)"
        intro={[
          "Manually checking someone's following list every day is tedious — and Instagram scrambles the order anyway. A real following tracker does the work for you: it records the list, watches for changes, and tells you the moment something shifts.",
          "CheckFollows is that tracker. Set it up once and we monitor the account every 24 hours, building a permanent history of follows and unfollows you can review anytime.",
        ]}
        sections={[
          {
            heading: "What a following tracker reveals",
            paragraphs: [
              "The value isn't just today's list — it's the difference between yesterday's list and today's. New follows, sudden unfollows, and patterns over time are what actually matter.",
            ],
            bullets: [
              "New follows — detected within 24 hours",
              "Unfollows — confirmed before we alert you",
              "True chronological ordering of the list",
              "A day-by-day activity timeline",
            ],
          },
          {
            heading: "How our tracking works",
            paragraphs: [
              "Your first scan establishes a baseline of everyone the account currently follows. From then on, each automatic scan is compared against the previous one. Additions and removals become entries in a timeline you can revisit forever.",
            ],
            bullets: [
              "Baseline established on first successful scan",
              "Daily automatic rescans, no manual clicks",
              "Change detection based on unique account IDs",
              "Suspicious partial scans are flagged, never trusted",
            ],
          },
        ]}
        features={[
          { icon: UserPlus, title: "New follow detection", body: "Know the moment they follow someone new." },
          { icon: Bell, title: "Automatic alerts", body: "Email notifications when meaningful changes happen." },
          { icon: History, title: "Permanent timeline", body: "Every change is saved and dated for review." },
          { icon: Shield, title: "Password-free", body: "No Instagram login or credentials required." },
          { icon: Eye, title: "Fully anonymous", body: "The account owner is never notified." },
          { icon: TrendingUp, title: "Pattern insight", body: "Spot networking habits and relationship signals." },
        ]}
        faqs={[
          {
            q: "How does an Instagram following tracker work?",
            a: "It periodically reads a public account's following list, stores snapshots, and diffs them over time to surface new follows and unfollows.",
          },
          {
            q: "Is this against Instagram's rules?",
            a: "CheckFollows only reads public data and never requires credentials or automated interaction with the app, keeping you safe.",
          },
          {
            q: "How often is the account checked?",
            a: "Paid plans rescan automatically every 24 hours by default, so changes are caught quickly.",
          },
          {
            q: "Can I track multiple accounts?",
            a: "Yes. Your subscription covers multiple tracked accounts in one place.",
          },
          {
            q: "What if the account is private?",
            a: "Private accounts can't be tracked. We only support public Instagram accounts.",
          },
        ]}
        related={[
          { href: "/see-who-someone-follows", label: "See who someone follows" },
          { href: "/who-unfollowed-me", label: "Who unfollowed me" },
          { href: "/see-who-someone-unfollowed", label: "See who someone unfollowed" },
          { href: "/instagram-follower-tracker", label: "Instagram follower tracker" },
          { href: "/anonymous-instagram-viewer", label: "Anonymous Instagram viewer" },
        ]}
      />
    </MarketingShell>
  );
}
