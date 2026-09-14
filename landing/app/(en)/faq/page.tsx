import { LocalizedFaqPage } from '@/components/LocalizedFaqPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('en', 'faq', getDictionarySync('en'))

export default function FaqPage() {
  return <LocalizedFaqPage locale="en" dictionary={getDictionarySync('en')} />
}
