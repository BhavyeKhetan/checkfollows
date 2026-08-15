"use client";

import { useState } from "react";
import { AccordionItem, Card } from "@/design-system";
import { track } from "@/lib/mixpanel";

export function FaqList({
  faqs,
  context = "generic",
}: {
  faqs: { q: string; a: string }[];
  context?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Card variant="default">
      {faqs.map((faq, i) => (
        <AccordionItem
          key={i}
          title={faq.q}
          isOpen={open === i}
          onToggle={() => {
            const next = open === i ? null : i;
            setOpen(next);
            if (next !== null) {
              track("faq_opened", { context, question: faq.q });
            }
          }}
        >
          {faq.a}
        </AccordionItem>
      ))}
    </Card>
  );
}
