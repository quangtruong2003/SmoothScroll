import { IntentLandingPage } from '@/components/seo/IntentLandingPage'
import { buildIntentMetadata, intentPageBySlug } from '@/lib/seo/intent-pages'

const page = intentPageBySlug['mac-like-scrolling-windows']

export const metadata = buildIntentMetadata(page)

export default function IntentPage() {
  return <IntentLandingPage page={page} />
}
