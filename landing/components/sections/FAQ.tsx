'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dict'
import { faqAnchorId, faqQuestions } from '@/lib/seo/faq'

interface FAQProps {
  dict: { faq?: Dictionary['faq'] }
  limit?: number
  viewAllHref?: string
}

export function FAQ({ dict, limit, viewAllHref }: FAQProps) {
  const f = dict?.faq ?? { title: '', questions: [] }
  const allQuestions = faqQuestions({ faq: f } as Dictionary)
  const questions = typeof limit === 'number' ? allQuestions.slice(0, limit) : allQuestions
  const [openItems, setOpenItems] = useState<string[]>([])

  const allValues = questions.map((_, idx) => `item-${idx}`)
  const allOpen = openItems.length === questions.length

  const toggleAll = () => {
    setOpenItems(allOpen ? [] : allValues)
  }

  return (
    <section className="px-4 py-[clamp(3rem,5vw,4.5rem)]">
      <div className="container">
        <div className="mx-auto max-w-3xl">
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
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={(value) => setOpenItems(value as string[])}
          >
            {questions.map((item, idx) => (
              <AccordionItem key={faqAnchorId(item.q, idx)} value={`item-${idx}`} id={faqAnchorId(item.q, idx)} className="scroll-mt-24">
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {viewAllHref && f.viewAll && (
            <div className="mt-8 text-center">
              <Button variant="outline" size="sm" asChild>
                <Link href={viewAllHref}>{f.viewAll}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
