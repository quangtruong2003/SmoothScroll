import { LocalizedHomePage } from '@/components/LocalizedHomePage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('en', 'home', getDictionarySync('en'))

export default function HomePage() {
  return <LocalizedHomePage locale="en" dictionary={getDictionarySync('en')} />
}
