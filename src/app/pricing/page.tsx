import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { Pricing } from "@/components/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing — CheckFollows",
  description:
    "Simple pricing for CheckFollows. Track who any Instagram account follows with every-other-day monitoring, from $9.99/week. Cancel anytime.",
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <Pricing />
    </MarketingShell>
  );
}
