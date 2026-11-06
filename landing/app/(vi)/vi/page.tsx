import { LocalizedHomePage } from '@/components/LocalizedHomePage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('vi', 'home', getDictionarySync('vi'))

export default function VietnameseHomePage() {
  return <LocalizedHomePage locale="vi" dictionary={getDictionarySync('vi')} />
}
