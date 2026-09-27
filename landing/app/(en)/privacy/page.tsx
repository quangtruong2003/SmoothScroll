import { LocalizedPrivacyPage } from '@/components/LocalizedPrivacyPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('en', 'privacy', getDictionarySync('en'))

export default function PrivacyPage() {
  return <LocalizedPrivacyPage locale="en" dictionary={getDictionarySync('en')} />
}
