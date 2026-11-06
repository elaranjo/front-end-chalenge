import { expect, test } from '@playwright/test'

test('an active favorites query receives price changes over the real simulated transport', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const price = await page.evaluate(async () => {
    const { runFavoritesRealtimeProbe } = await import('/tests/fixtures/favorites-realtime-probe.ts')
    return runFavoritesRealtimeProbe()
  })
  expect(price).toBe('2.50')
})
