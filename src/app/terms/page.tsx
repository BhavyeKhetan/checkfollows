import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — CheckFollows",
  description:
    "The terms that govern your use of CheckFollows, including eligibility, payments, and disclaimers.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="August 23, 2026">
      <p className="text-[15px] leading-relaxed text-[#555555]">
        Welcome to CheckFollows. These Terms of Service (&ldquo;Terms&rdquo;)
        govern your access to and use of our website, services, and tools
        (collectively, the &ldquo;Service&rdquo;). By using CheckFollows, you
        agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <LegalSection title="1. Eligibility & Use">
        <p>
          You must be at least 18 years old or the age of majority in your
          jurisdiction to use CheckFollows. By using the Service, you confirm
          that:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are legally capable of entering into a binding contract.</li>
          <li>
            You will use the Service for lawful, personal, non-commercial
            purposes.
          </li>
          <li>
            You will not use the Service to harass, stalk, or violate the privacy
            rights of any individual.
          </li>
        </ul>
        <p>
          We reserve the right to restrict or terminate access to any user at our
          sole discretion, without notice, if we believe a user is violating
          these Terms.
        </p>
      </LegalSection>

      <LegalSection title="2. User Conduct">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Use the Service to collect, scrape, or analyze data in violation of
            Instagram&apos;s or any third party&apos;s terms of service.
          </li>
          <li>
            Use automation, bots, or any unauthorized tools to interact with the
            platform.
          </li>
          <li>
            Circumvent technical limitations or reverse-engineer any part of the
            Service.
          </li>
          <li>
            Use the Service to impersonate, defame, or harm any individual or
            entity.
          </li>
        </ul>
        <p>
          We do not guarantee the accuracy of any data retrieved or displayed.
          All use is at your own risk.
        </p>
      </LegalSection>

      <LegalSection title="3. Privacy">
        <p>
          We collect limited data to operate the Service, including device and
          session information. By using CheckFollows, you consent to our Privacy
          Policy and to the processing of your data in accordance with it.
        </p>
        <p>
          You agree not to upload or transmit any personal data of others unless
          you have obtained their express, informed consent or otherwise have a
          lawful basis to do so.
        </p>
      </LegalSection>

      <LegalSection title="4. Account & Payment">
        <p>
          Some features require a subscription. Subscriptions are billed weekly
          or quarterly on a recurring basis. By subscribing, you authorize
          CheckFollows to charge your chosen payment method on a recurring basis
          until you cancel.
        </p>
        <p>
          We may modify pricing, plans, or features at any time. Continued use
          after changes constitutes acceptance. Cancellation and refund terms are
          described in our Refund Policy.
        </p>
        <p>
          Paid plans include a weekly pool of scan credits shared across tracked
          accounts. One scan credit covers up to 1,000 following profiles in a
          successful complete scan. The current cost is shown before you approve
          an account or request a rescan. Failed or incomplete scans are refunded.
          Included credits refresh weekly and do not roll over. On-demand
          rescans use separately purchased credits, which do not expire while
          your account remains open.
        </p>
      </LegalSection>

      <LegalSection title="5. Disclaimers">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            We are not affiliated with, endorsed by, or sponsored by Instagram,
            Meta Platforms, Inc., or any third-party platform.
          </li>
          <li>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available.&rdquo;
          </li>
          <li>
            We disclaim all warranties — express or implied — including
            merchantability, fitness for a particular purpose, and
            non-infringement.
          </li>
          <li>
            You acknowledge that using the Service may breach Instagram&apos;s or
            other platforms&apos; terms, and you assume full responsibility.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, CheckFollows, its affiliates,
          and owners are not liable for any indirect, incidental, punitive, or
          consequential damages, including loss of data, access, or reputation,
          arising out of or related to your use of the Service.
        </p>
        <p>
          In no event shall our total liability exceed the amount paid (if any)
          by you in the six (6) months preceding the claim.
        </p>
      </LegalSection>

      <LegalSection title="7. Termination">
        <p>
          We may suspend or terminate your access at any time, for any reason,
          including breach of these Terms. You may terminate at any time by
          ceasing to use the Service and canceling your subscription.
        </p>
      </LegalSection>

      <LegalSection title="8. Governing Law">
        <p>
          These Terms are governed by the laws of the State of Delaware, without
          regard to conflict of law principles. You agree to resolve disputes
          exclusively in the courts located in Wilmington, Delaware.
        </p>
      </LegalSection>

      <LegalSection title="9. Modifications">
        <p>
          We may update these Terms at any time. Continued use after changes
          constitutes acceptance. We will post updates on this page and update
          the &ldquo;Last Updated&rdquo; date above.
        </p>
      </LegalSection>

      <LegalSection title="10. Refund & Cancellation Policy">
        <p>
          All new purchases include a 7-day guarantee during which you may
          request a cancellation and a full refund of the original amount
          charged. After seven days, services are already being rendered and
          CheckFollows will cancel the subscription but not provide a refund.
          Full details are in our Refund Policy.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions? Email us at:{" "}
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
