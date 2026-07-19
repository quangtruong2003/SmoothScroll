'use client'

import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dict'

interface FAQProps {
  dict: { faq?: Dictionary['faq'] }
}

export function FAQ({ dict }: FAQProps) {
  const f = dict?.faq ?? { title: '', questions: [] }
  const questions = f.questions ?? []
  const [openItems, setOpenItems] = useState<string[]>([])

  const allValues = questions.map((_, idx) => `item-${idx}`)
  const allOpen = openItems.length === questions.length

  const toggleAll = () => {
    setOpenItems(allOpen ? [] : allValues)
  }

  return (
    <section className="px-4 pt-32 pb-8 md:pt-48 md:pb-12">
      <div className="container">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center sm:text-left flex-1">
            {f.title}
          </h2>
          {questions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
              aria-label={allOpen ? 'Collapse all questions' : 'Expand all questions'}
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </Button>
          )}
        </div>
        <div className="mx-auto max-w-3xl">
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={(value) => setOpenItems(value as string[])}
          >
            {questions.map((item, idx) => (
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
