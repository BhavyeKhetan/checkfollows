import type { Metadata } from "next";
import { UserMinus, Eye, Heart, Shield, Bell, History } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "Who Unfollowed Me on Instagram — CheckFollows",
  description:
    "Find out who unfollowed you on Instagram. Track follower changes over time with daily monitoring and alerts. No login required.",
  alternates: { canonical: "/who-unfollowed-me" },
};

export default function Page() {
  return (
    <MarketingShell>
      <SeoPage
        badge="WHO UNFOLLOWED ME"
        title={
          <>
            Find out who{" "}
            <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">
              unfollowed you
            </span>{" "}
            on Instagram
          </>
        }
        subtitle="Instagram never tells you when someone stops following you. CheckFollows watches your follower list and reveals exactly who left — and when."
        placeholder="Enter your handle... (e.g. yourname)"
        intro={[
          "Unfollows are silent on Instagram. There's no notification, no badge, no warning — the person just disappears from your follower count and you're left guessing.",
          "CheckFollows keeps a running snapshot of your followers, so the moment someone unfollows, we know. You get a clear, chronological record of who left and who stayed.",
        ]}
        sections={[
          {
            heading: "How unfollow tracking works",
            paragraphs: [
              "We scan your public follower list and save it as a baseline. On every subsequent check we compare the new list against the previous one. Anyone who was there before but is missing now shows up as an unfollow.",
            ],
            bullets: [
              "Baseline snapshot on first scan",
              "Daily automatic re-checks",
              "Clear 'unfollowed' markers with dates",
              "No guesswork — only real changes",
            ],
          },
          {
            heading: "Why people care about unfollows",
            paragraphs: [
              "For some it's about relationships; for others it's about influence. Creators and businesses watch unfollows to understand what content turns people away, while regular users simply want to know who quietly left.",
            ],
            bullets: [
              "See who left after a breakup or argument",
              "Spot audience churn for your own account",
              "Understand engagement drop-offs",
              "React while you still have context",
            ],
          },
        ]}
        features={[
          { icon: UserMinus, title: "Exact unfollows", body: "See precisely who unfollowed and when it happened." },
          { icon: Eye, title: "Anonymous", body: "Monitoring your own account never notifies anyone else." },
          { icon: Shield, title: "No password", body: "We never ask for your Instagram login credentials." },
          { icon: Bell, title: "Instant alerts", body: "Get notified the moment an unfollow is detected." },
          { icon: History, title: "Full history", body: "A permanent timeline of everyone who ever left." },
          { icon: Heart, title: "Peace of mind", body: "Stop refreshing and wondering — get the real answer." },
        ]}
        faqs={[
          {
            q: "Can I see who unfollowed me on Instagram?",
            a: "Yes. CheckFollows compares snapshots of your public follower list over time and shows you exactly who unfollowed and when.",
          },
          {
            q: "Does Instagram show who unfollowed you?",
            a: "No. Instagram deliberately hides unfollows. Third-party tools like CheckFollows are the only way to see them.",
          },
          {
            q: "Do I need to give you my password?",
            a: "Never. We only read public data, so your account stays completely safe.",
          },
          {
            q: "How often is my follower list checked?",
            a: "Paid plans monitor automatically every 24 hours, so unfollows are caught within a day.",
          },
          {
            q: "Will the person know I'm checking?",
            a: "No. There's no interaction with Instagram on your behalf, so nobody is alerted.",
          },
        ]}
        related={[
          { href: "/see-who-someone-follows", label: "See who someone follows" },
          { href: "/see-who-someone-unfollowed", label: "See who someone unfollowed" },
          { href: "/instagram-following-tracker", label: "Instagram following tracker" },
          { href: "/instagram-follower-tracker", label: "Instagram follower tracker" },
          { href: "/anonymous-instagram-viewer", label: "Anonymous Instagram viewer" },
        ]}
      />
    </MarketingShell>
  );
}
