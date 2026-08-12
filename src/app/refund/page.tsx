import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy — CheckFollows",
  description:
    "CheckFollows' 7-day refund guarantee, cancellation terms, and how to request a refund.",
};

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy" updated="August 12, 2026">
      <p className="text-[15px] leading-relaxed text-[#555555]">
        We understand that trust is everything. That is why we offer a limited
        7-day refund guarantee, but only in cases where the Service does not
        function as intended. Please read this policy carefully to understand
        what qualifies (and what does not).
      </p>

      <LegalSection title="When You Can Get a Refund">
        <p>
          We offer full refunds within 7 days of purchase only if you meet all of
          the following criteria:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The product failed to work as described, and</li>
          <li>
            You contacted our support team and gave us a chance to fix the issue,
            and
          </li>
          <li>
            You cooperated with our troubleshooting steps, including sharing
            screenshots, browser details, and error behavior, and
          </li>
          <li>
            Your account was not flagged for misuse, automated scraping, API
            abuse, or suspicious behavior.
          </li>
        </ul>
        <p>
          This policy covers technical failure only. We do not issue refunds
          based on misunderstanding the Service, changes of mind, or
          dissatisfaction with the insights provided.
        </p>
      </LegalSection>

      <LegalSection title="When Refunds Are Not Granted">
        <p>We do not issue refunds when:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You used the product successfully but did not find the data you hoped for.</li>
          <li>
            You misunderstood how it works (for example, it does not access
            private accounts or reveal restricted content).
          </li>
          <li>You forgot to cancel your subscription.</li>
          <li>You did not use the product at all but had access.</li>
          <li>Your account was flagged for violating our Terms of Service.</li>
          <li>You initiated a chargeback or dispute before contacting our support.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Auto-Renewals & Cancellations">
        <p>All subscriptions renew automatically unless canceled before the next billing date.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for managing your subscription.</li>
          <li>Cancel anytime through your account — no need to email.</li>
          <li>Cancellation stops future charges, not past ones.</li>
          <li>
            We do not issue pro-rated refunds if you cancel partway through a
            billing period.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How to Request a Refund">
        <p>
          If you believe you qualify for a refund under our 7-day functionality
          policy, email{" "}
          <a
            href="mailto:team@checkfollows.com"
            className="font-semibold text-[#121212] underline underline-offset-2"
          >
            team@checkfollows.com
          </a>{" "}
          with:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The email you used to sign up.</li>
          <li>A clear explanation of the issue.</li>
          <li>Screenshots, video recordings, or error messages, if available.</li>
        </ul>
        <p>
          Our team will respond within 2 business days. If the issue is confirmed
          and cannot be resolved, we will process the refund within 5–7 business
          days.
        </p>
      </LegalSection>

      <LegalSection title="Abuse & Chargebacks">
        <p>
          We monitor for refund abuse and reserve the right to block access to
          the Service if we detect fraudulent behavior or chargeback attempts.
          Customers who initiate chargebacks without first contacting support may
          be permanently banned from future use of CheckFollows.
        </p>
      </LegalSection>

      <LegalSection title="Still Have Questions?">
        <p>
          Email us at:{" "}
          <a
            href="mailto:team@checkfollows.com"
            className="font-semibold text-[#121212] underline underline-offset-2"
          >
            team@checkfollows.com
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
