import { LocalizedHowItWorksPage } from '@/components/LocalizedHowItWorksPage'
import { getDictionarySync } from '@/lib/i18n/dict'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata('zh', 'how-it-works', getDictionarySync('zh'))

export default function ChineseHowItWorksPage() {
  return <LocalizedHowItWorksPage locale="zh" dictionary={getDictionarySync('zh')} />
}
