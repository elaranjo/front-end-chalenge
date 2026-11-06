import { expect, test } from '@playwright/test'

test('scenario URL selects a fixture once and refresh preserves the session', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/?mockScenario=empty')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect.poll(() => page.evaluate(async () => (await (await fetch('/api/v1/__mock/state')).json()).scenario)).toBe('empty')
  expect(await page.evaluate(async () => (await (await fetch('/api/v1/nfts')).json()).total)).toBe(0)
  await page.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
  })
  const before = await page.evaluate(() => localStorage.getItem('kurio.session-token'))
  await page.reload()
  await expect.poll(() => page.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    return sessionManager.session?.userId ?? null
  })).toBe('collector-a')
  expect(await page.evaluate(() => localStorage.getItem('kurio.session-token'))).toBe(before)
})

test('visual cart does not change when the viewport is resized', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://127.0.0.1:5173/?mockScenario=visual-mobile')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const cart = () => page.evaluate(async () => {
    const visitorId = localStorage.getItem('kurio.visitor-id')
    if (!visitorId) throw new Error('Visitor identity not initialized')
    const response = await fetch('/api/v1/cart', { headers: { 'X-Visitor-Id': visitorId } })
    if (!response.ok) throw new Error(`Cart failed: ${response.status}`)
    const body = await response.json()
    return { lines: body.lines, total: body.quote.total }
  })
  const before = await cart()
  await page.setViewportSize({ width: 414, height: 896 })
  await page.reload()
  await expect(page.locator('.home-card').first()).toBeVisible()
  expect(await cart()).toEqual(before)
  expect(before.total).toBe('8.156')
})
