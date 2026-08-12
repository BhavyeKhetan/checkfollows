import type { Metadata } from "next";
import { Ghost, Eye, Shield, Lock, Search, History } from "lucide-react";
import { MarketingShell } from "@/components/marketing/shell";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "Anonymous Instagram Viewer — CheckFollows",
  description:
    "View any public Instagram profile and see recent follows anonymously. No login, no trace, no notifications. See who they follow without them knowing.",
  alternates: { canonical: "/anonymous-instagram-viewer" },
};

export default function Page() {
  return (
    <MarketingShell>
      <SeoPage
        badge="ANONYMOUS INSTAGRAM VIEWER"
        title={
          <>
            Anonymous{" "}
            <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">
              Instagram viewer
            </span>
          </>
        }
        subtitle="Look at any public Instagram profile — including who they recently followed — without logging in, without leaving a trace, and without them ever knowing."
        placeholder="Enter any public handle... (e.g. alex)"
        intro={[
          "Curiosity is normal. Risking your privacy to satisfy it isn't. With CheckFollows you can inspect any public Instagram profile and see their recent follows and followers without an account, without a login, and without the other person being notified.",
          "There's no app to install, no password to hand over, and no accidental 'like' on a three-year-old photo. Just the information you want, delivered privately.",
        ]}
        sections={[
          {
            heading: "How anonymous viewing works",
            paragraphs: [
              "We read only the public data Instagram already exposes, using our own infrastructure. Because we never log into your account and never interact with Instagram on your behalf, there's nothing to trace back to you.",
            ],
            bullets: [
              "No Instagram account or login required",
              "No cookies, no tracking, no footprint",
              "The profile owner is never notified",
              "Works entirely in your browser",
            ],
          },
          {
            heading: "What you can see anonymously",
            paragraphs: [
              "A quick preview returns the profile picture, bio, follower and following counts — and then unlocks the real value: the chronological list of who they follow and who follows them.",
            ],
            bullets: [
              "Profile info and bio",
              "Follower and following counts",
              "Recent follows in true order",
              "Recent followers and change history",
            ],
          },
        ]}
        features={[
          { icon: Ghost, title: "Zero footprint", body: "Nothing ties the search back to you." },
          { icon: Lock, title: "No password", body: "We never ask for Instagram credentials." },
          { icon: Shield, title: "Private & safe", body: "Reads public data only — nothing shady." },
          { icon: Search, title: "Instant results", body: "Preview profiles in seconds." },
          { icon: Eye, title: "Untraceable", body: "The target is never alerted." },
          { icon: History, title: "Full history", body: "Unlock timelines and change monitoring." },
        ]}
        faqs={[
          {
            q: "Is anonymous Instagram viewing really possible?",
            a: "Yes. For public accounts, we read only publicly available data through our own systems, so the account owner never knows you looked.",
          },
          {
            q: "Do I need an Instagram account?",
            a: "No. CheckFollows works without any Instagram login or account.",
          },
          {
            q: "Will the person get a notification?",
            a: "Never. We don't interact with Instagram on your behalf, so no view, like, or notification is ever triggered.",
          },
          {
            q: "Can I view private accounts anonymously?",
            a: "No. Private accounts aren't accessible through public data. We only support public profiles.",
          },
          {
            q: "Is it legal?",
            a: "Viewing publicly available information is legal. We never bypass any privacy settings or require credentials.",
          },
        ]}
        related={[
          { href: "/see-who-someone-follows", label: "See who someone follows" },
          { href: "/who-unfollowed-me", label: "Who unfollowed me" },
          { href: "/see-who-someone-unfollowed", label: "See who someone unfollowed" },
          { href: "/instagram-following-tracker", label: "Instagram following tracker" },
          { href: "/instagram-follower-tracker", label: "Instagram follower tracker" },
        ]}
      />
    </MarketingShell>
  );
}
