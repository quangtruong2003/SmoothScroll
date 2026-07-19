import { expect, test } from '@playwright/test'

const localePages = [
  { path: '/', lang: 'en', ogLocale: 'en_US', text: 'Mouse wheel scrolling,', answer: 'SmoothScroll is a Windows smooth-scrolling utility.' },
  { path: '/vi/', lang: 'vi', ogLocale: 'vi_VN', text: 'Cuộn chuột', answer: 'SmoothScroll là tiện ích cuộn mượt cho Windows.' },
  { path: '/zh/', lang: 'zh-Hans', ogLocale: 'zh_CN', text: '滚动', answer: 'SmoothScroll 是 Windows 平滑滚动工具。' },
  { path: '/how-it-works/', lang: 'en', ogLocale: 'en_US', text: 'See how SmoothScroll' },
  { path: '/vi/how-it-works/', lang: 'vi', ogLocale: 'vi_VN', text: 'Xem cách SmoothScroll' },
  { path: '/zh/how-it-works/', lang: 'zh-Hans', ogLocale: 'zh_CN', text: '看 SmoothScroll' },
] as const

const canonicalCases = [
  ['/', 'https://smoothscroll.top/'],
  ['/vi/', 'https://smoothscroll.top/vi/'],
  ['/zh/', 'https://smoothscroll.top/zh/'],
  ['/how-it-works/', 'https://smoothscroll.top/how-it-works/'],
  ['/vi/how-it-works/', 'https://smoothscroll.top/vi/how-it-works/'],
  ['/zh/how-it-works/', 'https://smoothscroll.top/zh/how-it-works/'],
] as const

for (const page of localePages) {
  test(`${page.path} serves localized raw HTML`, async ({ request }) => {
    const response = await request.get(page.path)
    const html = await response.text()

    await expect(response).toBeOK()
    expect(html).toContain(`<html lang="${page.lang}"`)
    expect(html).toContain(`property="og:locale" content="${page.ogLocale}"`)
    expect(html).toContain(page.text)
  })
}

for (const [path, canonical] of canonicalCases) {
  test(`${path} has self-canonical and reciprocal hreflang`, async ({ request }) => {
    const html = await (await request.get(path)).text()

    expect(html).toContain(`rel="canonical" href="${canonical}"`)
    expect(html).toMatch(/hrefLang="en"|hreflang="en"/)
    expect(html).toMatch(/hrefLang="vi"|hreflang="vi"/)
    expect(html).toMatch(/hrefLang="zh-Hans"|hreflang="zh-Hans"/)
    expect(html).toMatch(/hrefLang="x-default"|hreflang="x-default"/)
  })
}

test('localized homepage graphs match their page language and bounded FAQ', async ({ request }) => {
  for (const page of localePages.slice(0, 3)) {
    const html = await (await request.get(page.path)).text()
    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)

    expect(match).not.toBeNull()
    const json = JSON.parse(match![1])
    const graph = json['@graph'] as { '@type': string; url?: string; inLanguage?: string; mainEntity?: unknown[] }[]
    const types = graph.map((item) => item['@type'])
    const webPage = graph.find((item) => item['@type'] === 'WebPage')
    const webSite = graph.find((item) => item['@type'] === 'WebSite')
    const faq = graph.find((item) => item['@type'] === 'FAQPage')

    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'WebPage', 'SoftwareApplication', 'FAQPage']))
    expect(webPage).toMatchObject({ url: `https://smoothscroll.top${page.path}`, inLanguage: page.lang })
    expect(webSite).toMatchObject({ inLanguage: page.lang })
    expect(faq?.mainEntity).toHaveLength(1)
    expect(JSON.stringify(faq)).not.toMatch(/near-zero CPU|battery impact|anti-cheat/i)
  }
})

test('localized guide graphs omit FAQPage and preserve page language', async ({ request }) => {
  for (const page of localePages.slice(3)) {
    const html = await (await request.get(page.path)).text()
    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)
    const graph = JSON.parse(match![1])['@graph'] as { '@type': string; url?: string; inLanguage?: string }[]
    const types = graph.map((item) => item['@type'])
    const webPage = graph.find((item) => item['@type'] === 'WebPage')

    expect(types).not.toContain('FAQPage')
    expect(webPage).toMatchObject({ url: `https://smoothscroll.top${page.path}`, inLanguage: page.lang })
  }
})

test('localized home pages publish visible citable answers', async ({ request }) => {
  for (const page of localePages.slice(0, 3)) {
    const html = await (await request.get(page.path)).text()
    if (!('answer' in page)) throw new Error(`Missing answer fixture for ${page.path}`)
    expect(html).toContain(page.answer)
    expect(html).toContain('https://github.com/quangtruong2003/SmoothScroll')
    expect(html).toContain('/how-it-works/')
    expect(html).toContain('2026-07-19')
    expect(html).toMatch(/maintained by|duy trì bởi|由.*维护/i)
  }
})

test('raw home HTML exposes locale links and page evidence', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)
  const json = JSON.parse(match![1])
  const webPage = json['@graph'].find((item: { '@type': string }) => item['@type'] === 'WebPage')

  expect(html).toMatch(/href="\/vi\/?"/)
  expect(html).toMatch(/href="\/zh\/?"/)
  expect(webPage.author).toEqual({ '@id': 'https://smoothscroll.top/#organization' })
  expect(webPage.dateModified).toBe('2026-07-19')
})

test('sitemap lists every localized canonical page', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  for (const url of canonicalCases.map(([, url]) => url)) {
    expect(xml).toContain(`<loc>${url}</loc>`)
  }
  expect(xml).not.toContain('marquee-debug')
  expect(xml).not.toContain('<lastmod>')
})

test('publishes optional AI discovery document', async ({ request }) => {
  const response = await request.get('/llms.txt')
  const text = await response.text()

  await expect(response).toBeOK()
  expect(text).toContain('# SmoothScroll')
  expect(text).toContain('https://smoothscroll.top/how-it-works/')
  expect(text).toContain('https://github.com/quangtruong2003/SmoothScroll')
})

test('keeps debug route out of search indexes', async ({ request }) => {
  const html = await (await request.get('/marquee-debug/')).text()
  expect(html).toMatch(/noindex/i)
})
