import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "About — CheckFollows",
  description:
    "CheckFollows lets you see who any public Instagram account recently followed — anonymously, with no login required.",
};

export default function AboutPage() {
  return (
    <LegalPage title="About CheckFollows">
      <p className="text-[15px] leading-relaxed text-[#555555]">
        CheckFollows answers one simple question:{" "}
        <span className="font-semibold text-[#121212]">
          who did they just follow?
        </span>
      </p>

      <LegalSection title="What we do">
        <p>
          We show you the most recent accounts any public Instagram profile
          followed or unfollowed — in true chronological order — without logging
          in, without installing anything, and without them ever knowing.
        </p>
        <p>
          Search is free. A quick preview shows the profile and its follower and
          following counts. For the full picture, a subscription unlocks the
          complete following history and, most importantly, continuous
          every-other-day monitoring — so you see changes as they happen instead of after the
          fact.
        </p>
      </LegalSection>

      <LegalSection title="Why we built it">
        <p>
          Curiosity about who someone follows is normal — and so is wanting to
          know before a connection, relationship, or collaboration goes further.
          We built CheckFollows to make that look-up private, fast, and
          respectful: you search anonymously, and we never store Instagram
          credentials.
        </p>
      </LegalSection>

      <LegalSection title="How it works">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Search</strong> any public Instagram username — free.
          </li>
          <li>
            <strong>Preview</strong> the profile and its counts instantly.
          </li>
          <li>
            <strong>Unlock</strong> the full following history and
            every-other-day monitoring with a weekly or quarterly plan.
          </li>
          <li>
            <strong>Get alerted</strong> (on Pro) when new follows or unfollows
            are detected.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Get in touch">
        <p>
          Questions, feedback, or press? Email us at{" "}
          <a
            href="mailto:team@checkfollows.com"
            className="font-semibold text-[#121212] underline underline-offset-2"
          >
            team@checkfollows.com
          </a>{" "}
          or start a search from the{" "}
          <Link
            href="/"
            className="font-semibold text-[#121212] underline underline-offset-2"
          >
            home page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
