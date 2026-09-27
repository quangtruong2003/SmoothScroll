import { LocalizedPrivacyPage } from '@/components/LocalizedPrivacyPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('vi', 'privacy', getDictionarySync('vi'))

export default function VietnamesePrivacyPage() {
  return <LocalizedPrivacyPage locale="vi" dictionary={getDictionarySync('vi')} />
}
