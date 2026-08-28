import { IntentLandingPage } from '@/components/seo/IntentLandingPage'
import { buildIntentMetadata, intentPageBySlug } from '@/lib/seo/intent-pages'

const page = intentPageBySlug['fix-choppy-scrolling-windows-11']

export const metadata = buildIntentMetadata(page)

export default function IntentPage() {
  return <IntentLandingPage page={page} />
}
