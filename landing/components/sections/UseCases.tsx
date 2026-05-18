import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FadeUp } from '@/components/motion/FadeUp'

interface UseCasesProps {
  dict: {
    useCases: {
      title: string
      tabs: {
        reading: { label: string; description: string }
        coding: { label: string; description: string }
        designing: { label: string; description: string }
      }
    }
  }
}

export function UseCases({ dict }: UseCasesProps) {
  const { useCases: u } = dict

  const tabs = [
    { key: 'reading', ...u.tabs.reading },
    { key: 'coding', ...u.tabs.coding },
    { key: 'designing', ...u.tabs.designing },
  ]

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-12">
            {u.title}
          </h2>
        </FadeUp>
        <FadeUp delay={0.1}>
          <Tabs defaultValue="reading" className="max-w-2xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                <div className="mt-6 p-8 rounded-xl border bg-card text-center">
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {tab.description}
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </FadeUp>
      </div>
    </section>
  )
}
