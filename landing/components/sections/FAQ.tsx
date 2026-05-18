import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

interface FAQProps {
  dict: {
    faq: {
      title: string
      questions: { q: string; a: string }[]
    }
  }
}

export function FAQ({ dict }: FAQProps) {
  const { faq: f } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-12">
          {f.title}
        </h2>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible>
            {f.questions.map((item, idx) => (
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
