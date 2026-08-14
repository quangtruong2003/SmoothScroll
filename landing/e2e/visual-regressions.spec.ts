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

test('hero scrolls away normally after the scrub video is removed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const initial = await page.locator('[data-hero-layout]').evaluate((hero) => ({
    heroHeight: hero.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
    heroChildPosition: getComputedStyle(hero.firstElementChild!).position,
    heroChildTop: hero.firstElementChild!.getBoundingClientRect().top,
  }))

  await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }))

  const scrolled = await page.locator('[data-hero-layout]').evaluate((hero) => ({
    heroTop: hero.getBoundingClientRect().top,
    heroChildTop: hero.firstElementChild!.getBoundingClientRect().top,
  }))

  expect(initial.heroHeight).toBeLessThanOrEqual(initial.viewportHeight + 1)
  expect(initial.heroChildPosition).toBe('static')
  expect(scrolled.heroTop).toBeLessThan(-200)
  expect(scrolled.heroChildTop).toBeLessThan(-200)
})

test('hero renders a single WebGL background without a video scroll range', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const canvas = page.locator('[data-hero-canvas]')

  // One token-driven canvas replaces the two per-theme scrub videos.
  await expect(canvas).toHaveCount(1)
  await expect(page.locator('video[src*="scrub"]')).toHaveCount(0)
  await expect.poll(() => page.locator('[data-hero-layout]').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(901)
  await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).width)).toBeGreaterThan(0)
})

test('hero falls back to its current-theme poster when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light')
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId, ...args) {
      if (contextId === 'webgl') return null
      return getContext.call(this, contextId, ...args)
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  await page.goto('/')

  const fallback = page.locator('[data-hero-fallback]')
  const canvas = page.locator('[data-hero-canvas]')
  await expect(fallback).toHaveCSS('opacity', '1')
  await expect(fallback).toHaveCSS('background-image', /smooth-scrolling-light-poster\.webp/)
  await expect(canvas).toHaveCSS('opacity', '0')

  await page.locator('html').evaluate((element) => {
    element.classList.remove('light')
    element.classList.add('dark')
  })

  await expect(fallback).toHaveCSS('background-image', /smooth-scrolling-dark-poster\.webp/)
})

test('hero stops animation and exposes its poster after WebGL context loss', async ({ page }) => {
  await page.addInitScript(() => {
    const requestAnimationFrame = window.requestAnimationFrame
    const cancelAnimationFrame = window.cancelAnimationFrame
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const heroFrameIds = new Set<number>()

    window.requestAnimationFrame = (callback) => {
      const id = requestAnimationFrame.call(window, callback)
      if (callback.toString().includes('time +=')) {
        heroFrameIds.add(id)
        const root = document.documentElement
        root.dataset.heroRequestedFrames = String(Number(root.dataset.heroRequestedFrames ?? '0') + 1)
      }
      return id
    }
    window.cancelAnimationFrame = (id) => {
      if (heroFrameIds.delete(id)) {
        const root = document.documentElement
        root.dataset.heroCancelledFrames = String(Number(root.dataset.heroCancelledFrames ?? '0') + 1)
      }
      cancelAnimationFrame.call(window, id)
    }
    motionPreference.addEventListener('change', () => {
      const root = document.documentElement
      root.dataset.heroMotionChanges = String(Number(root.dataset.heroMotionChanges ?? '0') + 1)
    })
  })
  await page.goto('/')

  const canvas = page.locator('[data-hero-canvas]')
  const fallback = page.locator('[data-hero-fallback]')
  const heroRequestedFrames = async () => Number(await page.locator('html').getAttribute('data-hero-requested-frames') ?? '0')
  const motionChanges = async () => Number(await page.locator('html').getAttribute('data-hero-motion-changes') ?? '0')

  await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).width)).toBeGreaterThan(0)
  await expect.poll(heroRequestedFrames).toBeGreaterThan(0)
  const cancelledBefore = Number(await page.locator('html').getAttribute('data-hero-cancelled-frames') ?? '0')

  await canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext('webgl')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  })

  await expect(fallback).toHaveCSS('opacity', '1')
  await expect(canvas).toHaveCSS('opacity', '0')
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-hero-cancelled-frames') ?? '0')).toBeGreaterThan(cancelledBefore)

  const requestedAfterLoss = await heroRequestedFrames()
  const changesBeforeReduce = await motionChanges()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(motionChanges).toBeGreaterThan(changesBeforeReduce)
  expect(await heroRequestedFrames()).toBe(requestedAfterLoss)

  const changesBeforeRestore = await motionChanges()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(motionChanges).toBeGreaterThan(changesBeforeRestore)
  expect(await heroRequestedFrames()).toBe(requestedAfterLoss)
})

test('hero background survives a theme switch without reloading', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const canvas = page.locator('[data-hero-canvas]')
  await expect(canvas).toBeAttached()

  await page.evaluate(() => {
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  })

  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeAttached()
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

  // The card is a token-driven gradient now, so assert the gradient stops and
  // border resolve from theme tokens rather than a flat background colour.
  const colors = await cta.evaluate((element) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'hsl(var(--muted) / 0.4)'
    document.body.append(probe)
    const mutedStop = getComputedStyle(probe).backgroundColor
    probe.style.backgroundColor = 'hsl(var(--border))'
    const borderToken = getComputedStyle(probe).backgroundColor
    probe.remove()
    const styles = getComputedStyle(element)
    return {
      image: styles.backgroundImage,
      borderColor: styles.borderTopColor,
      mutedStop,
      borderToken,
    }
  })

  expect(colors.image).toContain('gradient')
  expect(colors.image).toContain(colors.mutedStop)
  expect(colors.borderColor).toBe(colors.borderToken)
})
