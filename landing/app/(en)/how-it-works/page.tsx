import { LocalizedHowItWorksPage } from '@/components/LocalizedHowItWorksPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('en', 'how-it-works', getDictionarySync('en'))

export default function HowItWorksPage() {
  return <LocalizedHowItWorksPage locale="en" dictionary={getDictionarySync('en')} />
}
