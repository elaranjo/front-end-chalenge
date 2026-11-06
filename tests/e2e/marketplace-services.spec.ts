import { expect, test } from '@playwright/test'

test('application cart services merge a visitor cart after login', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const { runCartMergeProbe } = await import('/tests/fixtures/marketplace-services-probe.ts')
    return runCartMergeProbe()
  })
  expect(result).toEqual({ visitorQuantity: 2, owner: 'user:collector-a', quantity: 2, userId: 'collector-a' })
})

test('application checkout services create and recover the same confirmed order', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const { runCheckoutProbe } = await import('/tests/fixtures/marketplace-services-probe.ts')
    return runCheckoutProbe()
  })
  expect(result.recoveredId).toBe(result.createdId)
  expect(result.status).toBe('confirmed')
  expect(result.total).toBe('2.396')
})

test('an active checkout quote updates on an NFT event and requires a new review', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const { runQuoteEventProbe } = await import('/tests/fixtures/marketplace-services-probe.ts')
    return runQuoteEventProbe()
  })
  expect(result).toEqual({ previous: '2.396', current: '3.016', status: 'review-required', hasAttempt: false })
})

test('runtime reconciles a pending order resolved while disconnected', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/?mockScenario=pending-disconnect')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const { runReconnectOrderProbe } = await import('/tests/fixtures/marketplace-services-probe.ts')
    return runReconnectOrderProbe()
  })
  expect(result.status).toBe('confirmed')
  expect(result.recovered).toBe(result.original)
  expect(result.attempt).toBe(result.original)
})
