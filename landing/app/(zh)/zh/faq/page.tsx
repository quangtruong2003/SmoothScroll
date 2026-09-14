import { LocalizedFaqPage } from '@/components/LocalizedFaqPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('zh', 'faq', getDictionarySync('zh'))

export default function ChineseFaqPage() {
  return <LocalizedFaqPage locale="zh" dictionary={getDictionarySync('zh')} />
}
