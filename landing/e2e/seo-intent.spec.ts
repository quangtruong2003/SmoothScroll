import { expect, test } from '@playwright/test'
import { intentPages, intentUrl } from '../lib/seo/intent-pages'

for (const intentPage of intentPages) {
  const path = `/${intentPage.slug}/`

  test(`${path} publishes crawlable intent-specific HTML`, async ({ request }) => {
    const response = await request.get(path)
    const html = await response.text()

    await expect(response).toBeOK()
    expect(html).toContain('<html lang="en"')
    expect(html).toContain(`<title>${intentPage.title}</title>`)
    expect(html).toContain(`rel="canonical" href="${intentUrl(intentPage.slug)}"`)
    expect(html).toContain(intentPage.heading)
    expect(html).toContain(intentPage.answer)
    expect(html).toContain('Download for Windows')
    expect(html).toContain('/how-it-works/')
  })

  test(`${path} keeps visible FAQ and structured FAQ synchronized`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)

    expect(match).not.toBeNull()
    const graph = JSON.parse(match![1])['@graph'] as {
      '@type': string
      url?: string
      inLanguage?: string
      mainEntity?: { name: string; acceptedAnswer: { text: string } }[]
      itemListElement?: { item: string }[]
      downloadUrl?: string
    }[]
    const types = graph.map((item) => item['@type'])
    const webPage = graph.find((item) => item['@type'] === 'WebPage')
    const software = graph.find((item) => item['@type'] === 'SoftwareApplication')
    const breadcrumb = graph.find((item) => item['@type'] === 'BreadcrumbList')
    const faq = graph.find((item) => item['@type'] === 'FAQPage')

    expect(types).toEqual(expect.arrayContaining(['WebPage', 'SoftwareApplication', 'BreadcrumbList', 'FAQPage']))
    expect(webPage).toMatchObject({ url: intentUrl(intentPage.slug), inLanguage: 'en' })
    expect(software?.downloadUrl).toBe('https://github.com/quangtruong2003/SmoothScroll/releases/latest')
    expect(breadcrumb?.itemListElement?.map(({ item }) => item)).toEqual([
      'https://smoothscroll.top/',
      intentUrl(intentPage.slug),
    ])
    expect(faq?.mainEntity).toHaveLength(intentPage.faq.length)

    for (const item of intentPage.faq) {
      expect(html).toContain(item.question)
      expect(html).toContain(item.answer)
    }
  })
}

test('sitemap includes all English search-intent pages', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()

  for (const intentPage of intentPages) {
    expect(xml).toContain(`<loc>${intentUrl(intentPage.slug)}</loc>`)
  }
  expect(xml).toContain('<lastmod>2026-08-29</lastmod>')
})

test('English homepage and guide link to the search-intent cluster', async ({ request }) => {
  for (const path of ['/', '/how-it-works/']) {
    const html = await (await request.get(path)).text()
    for (const intentPage of intentPages) {
      expect(html).toContain(`href="/${intentPage.slug}/"`)
    }
  }
})
