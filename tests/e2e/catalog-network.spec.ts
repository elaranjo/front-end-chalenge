import { expect, test } from '@playwright/test'

test('preview initializes MSW before serving the persistent catalog', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/v1/nfts?q=Emerald')
    return { status: response.status, payload: await response.json() }
  })
  expect(result.status).toBe(200)
  expect(result.payload.items[0].id).toBe('emerald-ape-042')
  await page.reload()
  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch('/api/v1/nfts/emerald-ape-042')
    return response.status
  })).toBe(200)
  const missing = await page.evaluate(async () => (await fetch('/api/v1/nfts/not-found')).status)
  expect(missing).toBe(404)
})
