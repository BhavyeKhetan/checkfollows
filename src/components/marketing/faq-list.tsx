"use client";

import { useState } from "react";
import { AccordionItem, Card } from "@/design-system";

export function FaqList({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Card variant="default">
      {faqs.map((faq, i) => (
        <AccordionItem
          key={i}
          title={faq.q}
          isOpen={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        >
          {faq.a}
        </AccordionItem>
      ))}
    </Card>
  );
}
