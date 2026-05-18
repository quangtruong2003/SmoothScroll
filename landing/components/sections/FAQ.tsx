'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { Dictionary } from '@/lib/i18n/dict'

interface FAQProps {
  dict: { faq?: Dictionary['faq'] }
}

export function FAQ({ dict }: FAQProps) {
  const f = dict?.faq ?? { title: '', questions: [] }

  return (
    <section className="py-20 px-4">
      <div className="container">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-12">
          {f.title}
        </h2>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible>
            {(f.questions ?? []).map((item, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
