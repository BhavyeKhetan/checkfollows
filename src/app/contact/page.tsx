import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Contact — CheckFollows",
  description:
    "Contact the CheckFollows team for support, billing, or refund questions.",
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p className="text-[15px] leading-relaxed text-[#555555]">
        We are here to help. Reach out any time — we typically respond within 2
        business days.
      </p>

      <LegalSection title="Email us">
        <p>
          For support, billing, or refund questions, email{" "}
          <a
            href="mailto:team@checkfollows.com"
            className="font-semibold text-[#121212] underline underline-offset-2"
          >
            team@checkfollows.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Refunds">
        <p>
          Before reaching out about a refund, review our{" "}
          <Link
            href="/refund"
            className="font-semibold text-[#121212] underline underline-offset-2"
          >
            Refund Policy
          </Link>{" "}
          to confirm your request qualifies.
        </p>
      </LegalSection>

      <LegalSection title="Frequently asked">
        <p>
          Many common questions are answered on the home page FAQ. If you still
          need help, email us and include:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The email you used to sign up.</li>
          <li>A clear description of the issue.</li>
          <li>Screenshots or error messages, if available.</li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
