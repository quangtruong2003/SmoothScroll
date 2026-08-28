import { IntentLandingPage } from '@/components/seo/IntentLandingPage'
import { buildIntentMetadata, intentPageBySlug } from '@/lib/seo/intent-pages'

const page = intentPageBySlug['smooth-scrolling-chrome-windows']

export const metadata = buildIntentMetadata(page)

export default function IntentPage() {
  return <IntentLandingPage page={page} />
}
