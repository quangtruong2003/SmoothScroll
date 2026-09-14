import { LocalizedFaqPage } from '@/components/LocalizedFaqPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('vi', 'faq', getDictionarySync('vi'))

export default function VietnameseFaqPage() {
  return <LocalizedFaqPage locale="vi" dictionary={getDictionarySync('vi')} />
}
