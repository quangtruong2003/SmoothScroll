import { test, expect } from '@playwright/test'

test('extension mutation of version script does not trigger hydration mismatch', async ({ page }) => {
  const hydrationErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('hydrated but some attributes')) {
      hydrationErrors.push(message.text())
    }
  })

  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const script = Array.from(document.scripts).find((element) =>
        element.textContent?.includes('app_version')
      )
      if (!script) return

      script.dataset.extensionMutated = 'true'
      script.textContent = ''
      observer.disconnect()
    })
    observer.observe(document, { childList: true, subtree: true })
  })

  await page.goto('/')
  await page.locator('main').waitFor()
  await expect(page.locator('head script[data-extension-mutated="true"]')).toHaveCount(1)
  expect(hydrationErrors).toEqual([])
})
