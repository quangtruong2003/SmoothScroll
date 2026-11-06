import { LocalizedPrivacyPage } from '@/components/LocalizedPrivacyPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('zh', 'privacy', getDictionarySync('zh'))

export default function ChinesePrivacyPage() {
  return <LocalizedPrivacyPage locale="zh" dictionary={getDictionarySync('zh')} />
}
