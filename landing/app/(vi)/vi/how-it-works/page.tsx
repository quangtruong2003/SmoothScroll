import { LocalizedHowItWorksPage } from '@/components/LocalizedHowItWorksPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('vi', 'how-it-works', getDictionarySync('vi'))

export default function VietnameseHowItWorksPage() {
  return <LocalizedHowItWorksPage locale="vi" dictionary={getDictionarySync('vi')} />
}
