import { LocalizedHomePage } from '@/components/LocalizedHomePage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('zh', 'home', getDictionarySync('zh'))

export default function ChineseHomePage() {
  return <LocalizedHomePage locale="zh" dictionary={getDictionarySync('zh')} />
}
