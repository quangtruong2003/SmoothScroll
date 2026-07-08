import { test, expect } from '@playwright/test'

test('home page makes zero requests to iconify.design', async ({ page }) => {
  const externalRequests: string[] = []

  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('iconify.design') || url.includes('api.iconify')) {
      externalRequests.push(url)
    }
  })

  await page.goto('/en/')
  await page.waitForLoadState('networkidle')

  expect(externalRequests).toEqual([])
})
