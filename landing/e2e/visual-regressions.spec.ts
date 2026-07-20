import { test, expect } from '@playwright/test'

test('hero copy stays within its container on mobile and tablet', async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 768, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const layout = await page.locator('[data-hero-layout]').evaluate((hero) => {
      const container = hero.querySelector('.container')!.getBoundingClientRect()
      const copy = hero.querySelector('[data-hero-copy]')!.getBoundingClientRect()
      const heading = hero.querySelector('h1')!.getBoundingClientRect()
      return {
        containerWidth: container.width,
        copyWidth: copy.width,
        headingWidth: heading.width,
      }
    })

    expect(layout.copyWidth).toBeLessThanOrEqual(layout.containerWidth)
    expect(layout.headingWidth).toBeLessThanOrEqual(layout.containerWidth)
  }
})

test('hero copy stays centered on tablet and desktop', async ({ page }) => {
  for (const viewport of [
    { width: 795, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const layout = await page.locator('[data-hero-layout]').evaluate((hero) => {
      const copy = hero.querySelector('[data-hero-copy]')!
      const rect = copy.getBoundingClientRect()
      return {
        center: rect.left + rect.width / 2,
        textAlign: getComputedStyle(copy).textAlign,
        viewportCenter: window.innerWidth / 2,
      }
    })

    expect(Math.abs(layout.center - layout.viewportCenter)).toBeLessThanOrEqual(1)
    expect(layout.textAlign).toBe('center')
  }
})

test('hero media remains sticky across its scroll range', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }))

  const layout = await page.locator('[data-hero-layout]').evaluate((hero) => {
    const sticky = hero.firstElementChild!.getBoundingClientRect()
    const tail = hero.querySelector('[data-hero-social-proof]')!.getBoundingClientRect()
    return {
      stickyTop: sticky.top,
      visibleBottomBlank: Math.min(hero.getBoundingClientRect().bottom, window.innerHeight) - tail.bottom,
    }
  })

  expect(Math.abs(layout.stickyTop)).toBeLessThanOrEqual(1)
  expect(layout.visibleBottomBlank).toBeLessThanOrEqual(132)
})

test('hero video follows theme and provides scroll distance', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('theme', 'light'))
  await page.reload()

  const lightVideo = page.locator('[data-hero-video="light"]')
  const darkVideo = page.locator('[data-hero-video="dark"]')
  await expect(lightVideo).toHaveAttribute('src', /smooth-scrolling-light-scrub\.mp4$/)
  await expect(darkVideo).toHaveAttribute('src', /smooth-scrolling-dark-scrub\.mp4$/)
  await expect(lightVideo).toHaveAttribute('muted', '')
  await expect(lightVideo).toHaveAttribute('playsinline', '')
  await expect.poll(() => page.locator('[data-hero-layout]').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(900)
  await expect.poll(() => lightVideo.evaluate((video) => (video as HTMLVideoElement).duration)).toBeGreaterThan(0)
  await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }))
  await expect.poll(() => lightVideo.evaluate((video) => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(1.4)
  await expect.poll(() => lightVideo.evaluate((video) => (video as HTMLVideoElement).currentTime)).toBeLessThan(2.1)

  await page.evaluate(() => {
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  })
  await expect(darkVideo).toBeVisible()
  await expect(lightVideo).toBeHidden()
})

test('logo wall uses compact spacing and glyph-only Windows icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const firstCell = page.locator('.logo-cell').first()
  await expect(firstCell).toHaveCSS('min-width', '112px')
  await expect(firstCell.locator('img')).toHaveAttribute('src', /\/windows\.svg$/)
})

test('before and after demo stays compact on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const scene = page.locator('[data-scroll-demo]')

  await expect(scene).toBeVisible()
  const layout = await scene.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const beforeRect = element.querySelector('[data-scroll-before]')!.getBoundingClientRect()
    const afterRect = element.querySelector('[data-scroll-after]')!.getBoundingClientRect()
    return { height: rect.height, beforeTop: beforeRect.top, afterTop: afterRect.top }
  })

  expect(layout.height).toBeLessThan(1350)
  expect(Math.abs(layout.beforeTop - layout.afterTop)).toBeLessThan(8)
})

test('final CTA follows dark theme surface tokens', async ({ page }) => {
  await page.goto('/')
  await page.locator('html').evaluate((element) => {
    element.classList.remove('light')
    element.classList.add('dark')
  })

  await expect(page.locator('html')).toHaveClass(/dark/)
  const cta = page.locator('[data-final-cta]')
  await expect(cta).toBeVisible()
  const colors = await cta.evaluate((element) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'hsl(var(--card))'
    document.body.append(probe)
    const expected = getComputedStyle(probe).backgroundColor
    probe.remove()
    return {
      actual: getComputedStyle(element).backgroundColor,
      expected,
    }
  })

  expect(colors.actual).toBe(colors.expected)
})
