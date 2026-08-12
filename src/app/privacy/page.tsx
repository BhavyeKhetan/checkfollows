import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — CheckFollows",
  description:
    "How CheckFollows collects, uses, and protects your data. We never collect your Instagram credentials.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="August 12, 2026">
      <p className="text-[15px] leading-relaxed text-[#555555]">
        This Privacy Policy explains how CheckFollows (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, and protects your
        data when you use our services, website, and tools (the
        &ldquo;Service&rdquo;). By using CheckFollows, you consent to the
        practices described below.
      </p>

      <LegalSection title="1. What We Collect">
        <p>We collect only the data necessary to operate and improve the Service:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Device info:</strong> browser, operating system, IP address,
            and session data.
          </li>
          <li>
            <strong>Usage data:</strong> page views, clicks, and interactions.
          </li>
          <li>
            <strong>Account data (if applicable):</strong> email address, billing
            information, and subscription status.
          </li>
          <li>
            <strong>Support conversations:</strong> messages you send us for help.
          </li>
        </ul>
        <p>We do not collect or store your Instagram credentials or access tokens.</p>
      </LegalSection>

      <LegalSection title="2. How We Use It">
        <p>We use the data we collect to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Provide and maintain the Service.</li>
          <li>Improve site performance and user experience.</li>
          <li>Send transactional or service-related messages.</li>
          <li>Prevent fraud and abuse.</li>
          <li>Comply with legal obligations.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Sharing of Data">
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not sell your data — ever.</li>
          <li>
            We may share data only with trusted service providers (such as our
            payment processor or hosting provider) solely to help us operate the
            Service. These partners are contractually bound to protect your data.
          </li>
          <li>
            We may disclose data if required by law, subpoena, or in connection
            with a legal claim or investigation.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Cookies & Tracking">
        <p>We use cookies and similar technologies for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Session management.</li>
          <li>Analytics.</li>
          <li>Improving performance.</li>
        </ul>
        <p>
          You can disable cookies in your browser, but some features may not work
          correctly.
        </p>
      </LegalSection>

      <LegalSection title="5. Data Retention">
        <p>
          We retain your data as long as necessary to provide the Service and meet
          legal obligations. You may request deletion of your data at any time by
          emailing us.
        </p>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>
          We implement technical and organizational measures to protect your data
          from unauthorized access, theft, or alteration. However, no system is
          100% secure.
        </p>
      </LegalSection>

      <LegalSection title="7. Your Rights">
        <p>Depending on your location, you may have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the data we hold about you.</li>
          <li>Request correction or deletion of your data.</li>
          <li>Object to data processing or request restriction.</li>
          <li>Withdraw consent at any time (where applicable).</li>
        </ul>
        <p>To exercise these rights, contact team@checkfollows.com.</p>
      </LegalSection>

      <LegalSection title="8. International Users">
        <p>
          Your data may be stored and processed in the United States or other
          jurisdictions. By using the Service, you consent to this transfer.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes">
        <p>
          We may update this policy. If we make changes, we will update the
          &ldquo;Last updated&rdquo; date and post the new version on this page.
        </p>
      </LegalSection>

      <LegalSection title="Questions?">
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
