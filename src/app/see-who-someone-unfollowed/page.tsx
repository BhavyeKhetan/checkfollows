import type { Metadata } from "next";
import { UserMinus, Eye, Heart, Shield, Bell, History } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "See Who Someone Unfollowed on Instagram — CheckFollows",
  description:
    "See who any public Instagram account unfollowed. Track unfollows with daily monitoring and get alerted the moment they cut someone loose. No login.",
  alternates: { canonical: "/see-who-someone-unfollowed" },
};

export default function Page() {
  return (
    <MarketingShell>
      <SeoPage
        badge="SEE WHO SOMEONE UNFOLLOWED"
        title={
          <>
            See who someone{" "}
            <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">
              unfollowed
            </span>
          </>
        }
        subtitle="An unfollow is a signal. CheckFollows watches any public account's following list and reveals exactly who they dropped — and when it happened."
        placeholder="Enter any public handle... (e.g. yourcrush)"
        intro={[
          "When someone unfollows an account, Instagram doesn't announce it. The name just vanishes from their following list, and unless you were watching closely, you'd never know.",
          "CheckFollows records snapshots of who an account follows, so the moment they unfollow someone, we can tell you exactly who it was and when it happened.",
        ]}
        sections={[
          {
            heading: "Why unfollows matter",
            paragraphs: [
              "An unfollow is one of the few public signals about a relationship or priority. Whether it's a personal connection drifting, a creator cutting ties with a brand, or a competitor changing strategy, the unfollow tells a story.",
            ],
            bullets: [
              "Personal: spot who's falling out of someone's orbit",
              "Creators: see which brand deals ended",
              "Business: track competitor strategy shifts",
              "Recruiting: notice when a candidate disconnects",
            ],
          },
          {
            heading: "How we detect unfollows reliably",
            paragraphs: [
              "We don't just assume an unfollow on the first missing scan — Instagram can return inconsistent results. We confirm removals across consecutive scans before reporting them, so you're never alarmed by a false positive.",
            ],
            bullets: [
              "Baseline snapshot on first scan",
              "Removals confirmed before being reported",
              "Suspicious partial scans are flagged, never trusted",
              "Dated timeline of every confirmed unfollow",
            ],
          },
        ]}
        features={[
          { icon: UserMinus, title: "Confirmed unfollows", body: "Only real, verified removals are reported to you." },
          { icon: Eye, title: "Anonymous", body: "The account owner never knows you're watching." },
          { icon: Shield, title: "No login", body: "No Instagram credentials required, ever." },
          { icon: Bell, title: "Change alerts", body: "Get notified the moment an unfollow is confirmed." },
          { icon: History, title: "Complete history", body: "A permanent record of every drop over time." },
          { icon: Heart, title: "Relationship clarity", body: "Understand what's really happening behind the scenes." },
        ]}
        faqs={[
          {
            q: "Can I see who someone unfollowed?",
            a: "Yes. For public accounts, CheckFollows compares following snapshots over time and shows you exactly who was unfollowed and when.",
          },
          {
            q: "Will the person know I checked?",
            a: "No. We only read public data and never interact with Instagram on your behalf, so nobody is notified.",
          },
          {
            q: "How can you tell an unfollow from a glitch?",
            a: "We confirm removals across multiple scans before reporting them, so temporary Instagram inconsistencies don't create false alarms.",
          },
          {
            q: "Does it work on private accounts?",
            a: "No. CheckFollows only supports public Instagram accounts.",
          },
          {
            q: "How much does it cost?",
            a: "Search is free. Monitoring starts at $9.99/week — cancel anytime.",
          },
        ]}
        related={[
          { href: "/see-who-someone-follows", label: "See who someone follows" },
          { href: "/who-unfollowed-me", label: "Who unfollowed me" },
          { href: "/instagram-following-tracker", label: "Instagram following tracker" },
          { href: "/instagram-follower-tracker", label: "Instagram follower tracker" },
          { href: "/anonymous-instagram-viewer", label: "Anonymous Instagram viewer" },
        ]}
      />
    </MarketingShell>
  );
}
