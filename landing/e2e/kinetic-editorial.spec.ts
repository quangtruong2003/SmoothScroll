import { test, expect } from '@playwright/test'

const LOCALES = ['en', 'vi', 'zh'] as const

async function expectNoHorizontalOverflow(page: any, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
}

async function expectNoForbiddenLabels(page: any) {
  await expect(page.locator('body')).not.toContainText(/SECTION 0|QUESTION 0|ABOUT US/i)
}

test.describe('kinetic editorial landing shell', () => {
  for (const width of [320, 390]) {
    test(`keeps navigation usable at ${width}px without a mobile drawer`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/')
      await expectNoForbiddenLabels(page)

      const navigation = page.locator('nav').first()
      await expect(navigation).toBeVisible()
      await expect(navigation.getByRole('link', { name: /GitHub/i })).toBeVisible()
      await expect(page.locator('[data-mobile-drawer]')).toHaveCount(0)
      await expectNoHorizontalOverflow(page, width)
    })
  }

  for (const locale of LOCALES) {
    test(`[${locale}] keeps editorial hero usable across viewports`, async ({ page }) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem('smoothscroll-locale', value)
      }, locale)

      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 })
        await page.goto('/')
        await expectNoForbiddenLabels(page)

        const hero = page.locator('[data-hero-layout="editorial-split"]')
        const heading = hero.getByRole('heading', { level: 1 })
        const ctas = hero.locator('[data-hero-cta]')
        await expect(heading).toBeVisible()
        await expect(ctas).toHaveCount(2)
        await expect(ctas.first()).toBeVisible()
        await expect(ctas.last()).toBeVisible()
        await ctas.last().focus()
        await expect(ctas.last()).toBeFocused()
        await expectNoHorizontalOverflow(page, width)
      }

      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/')
      await expectNoForbiddenLabels(page)
      const heading = page.locator('[data-hero-layout="editorial-split"]').getByRole('heading', { level: 1 })
      const lineCount = await heading.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size
      })
      expect(lineCount).toBeLessThanOrEqual(3)
    })
  }

  test('keeps editorial structure and secondary CTA behavior', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expectNoForbiddenLabels(page)

    const hero = page.locator('[data-hero-layout="editorial-split"]')
    await expect(hero.locator('[data-hero-copy]')).toBeVisible()
    await expect(hero.locator('[data-hero-visual]')).toHaveCount(0)
    await expect(hero.locator('[data-hero-eyebrow]')).toBeVisible()
    await expect(hero.locator('[data-hero-social-proof]')).toBeVisible()
    await expect(hero.locator('[data-hero-badge], [data-hero-stamp], [data-hero-stats], [data-hero-pill-row]')).toHaveCount(0)

    const secondaryCta = hero.locator('[data-hero-secondary-cta]')
    await expect(secondaryCta).toHaveAttribute('href', '/how-it-works/')
    await secondaryCta.focus()
    await expect(secondaryCta).toBeFocused()
  })

  test('uses gapless dense feature bento and preserves continuation items', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const bento = page.locator('.features-bento')
    await expect(bento).toHaveCSS('grid-auto-flow', 'dense')
    await expect(bento.locator('[data-feature-card="0"]')).toHaveAttribute('data-grid-span', '7x2')
    await expect(bento.locator('[data-feature-card="1"]')).toHaveAttribute('data-grid-span', '5x1')
    await expect(bento.locator('[data-feature-card="2"]')).toHaveAttribute('data-grid-span', '5x1')
    await expect(bento.locator('[data-feature-card]')).toHaveCount(3)
    await expect(bento.locator('[data-feature-continuation-item]')).toHaveCount(3)
  })

  test('keeps feature bento overflow-free on mobile', async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/')
      await expect(page.locator('.features-bento')).toBeVisible()
      await expectNoHorizontalOverflow(page, width)
    }
  })
  test('disables LogoWall motion when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const region = page.getByRole('region', { name: 'Compatible apps and operating systems' })
    await expect(region).toHaveCount(1)
    await expect(region.locator('.marquee-track')).toHaveCSS('animation-name', 'none')
  })

  test('activates pain points by keyboard and exposes expanded descriptions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const accordion = page.locator('[data-pain-points-accordion]')
    const buttons = accordion.getByRole('button')
    await expect(buttons).toHaveCount(3)
    const targetButton = buttons.nth(1)
    await targetButton.focus()
    await expect(targetButton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(targetButton).toHaveAttribute('aria-expanded', 'true')
    const targetPanel = accordion.locator(`#${await targetButton.getAttribute('aria-controls')}`)
    await expect(targetPanel).toBeVisible()
    await expect(targetPanel).toHaveText(/\S+/)
  })

  test('keeps pain points accessible as mobile vertical disclosures', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const accordion = page.locator('[data-pain-points-accordion]')
    const buttons = accordion.getByRole('button')
    await expect(buttons).toHaveCount(3)
    await expect(buttons.nth(0)).toHaveAttribute('aria-controls', 'pain-point-panel-0')
    await expect(buttons.nth(0)).toHaveAttribute('aria-expanded', 'true')
    await buttons.nth(2).click()
    await expect(buttons.nth(2)).toHaveAttribute('aria-expanded', 'true')
    await expect(accordion.locator('[role="region"]').nth(2)).toBeVisible()
    await expectNoHorizontalOverflow(page, 390)
  })

  test('uses decorative product image in solution bridge', async ({ page }) => {
    await page.goto('/')
    const image = page.locator('[data-solution-bridge] img')
    await expect(image).toHaveAttribute('alt', '')
    await expect(image.locator('..')).toHaveAttribute('aria-hidden', 'true')
  })

  test('keeps before and after comparison compact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const scene = page.locator('[data-scroll-demo]')
    await expect(scene).toHaveCount(1)
    const before = scene.locator('img[alt="Jumpy, sluggish scrolling on Windows without SmoothScroll"]')
    const after = scene.locator('img[alt="Smooth, fluid scrolling on Windows with SmoothScroll installed"]')
    await expect(before).toHaveAttribute('src', /\/assets\/before\.gif$/)
    await expect(after).toHaveAttribute('src', /\/assets\/after\.gif$/)
    await expect(before).toHaveAttribute('width', '650')
    await expect(after).toHaveAttribute('height', '366')
    await expect(before).toHaveAttribute('loading', 'lazy')
    await expect(after).toHaveAttribute('loading', 'lazy')

    await before.evaluate((image) => image.dispatchEvent(new Event('error')))
    await after.evaluate((image) => image.dispatchEvent(new Event('error')))
    await expect(scene.locator('[data-scroll-demo-fallback]')).toHaveCount(2)
    await expect(scene).toContainText('Before (demo unavailable)')
    await expect(scene).toContainText('After (demo unavailable)')
  })

  test('keeps ScrollDemo compact on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const scene = page.locator('[data-scroll-demo]')
    await expect(scene).toBeVisible()
    await expectNoHorizontalOverflow(page, 390)
  })
})
