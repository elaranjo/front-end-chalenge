import { expect, test } from '@playwright/test'

test('realtime runtime rebinds when session changes', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect(page.locator('.home-page')).toBeVisible()
  const ready = () => page.evaluate(async () => (await import('/src/app/realtime.ts')).realtime.isReady)
  await expect.poll(ready).toBe(true)
  const failedLogin = await page.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    try { await sessionManager.login('colecionador.a@kurio.test', 'errada'); return false } catch { return true }
  })
  expect(failedLogin).toBe(true)
  await expect.poll(ready).toBe(true)
  await page.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
  })
  await expect.poll(ready).toBe(true)
  expect(await page.evaluate(async () => (await import('/src/app/session.ts')).sessionManager.session?.userId)).toBe('collector-a')
  await page.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    await sessionManager.logout()
  })
  await expect.poll(ready).toBe(true)
  expect(await page.evaluate(async () => (await import('/src/app/session.ts')).sessionManager.session)).toBeNull()
})

test('focus suspends confirmation until active resources are reconciled', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  const result = await page.evaluate(async () => {
    const { runFocusReconciliationProbe } = await import('/tests/fixtures/focus-reconciliation-probe.ts')
    return runFocusReconciliationProbe()
  })
  expect(result).toEqual({ blocked: true, refreshed: true })
})

test('repeated runtime start and stop does not accumulate focus listeners', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  const counts = await page.evaluate(async () => {
    const { realtime } = await import('/src/app/realtime.ts')
    realtime.stop()
    const originalAdd = window.addEventListener
    const originalRemove = window.removeEventListener
    const listeners = new Set<EventListenerOrEventListenerObject>()
    window.addEventListener = function (type, listener, options) {
      if (type === 'focus' && listener) listeners.add(listener)
      return originalAdd.call(this, type, listener, options)
    }
    window.removeEventListener = function (type, listener, options) {
      if (type === 'focus' && listener) listeners.delete(listener)
      return originalRemove.call(this, type, listener, options)
    }
    try {
      realtime.start(); realtime.start()
      const started = listeners.size
      realtime.stop(); realtime.stop()
      const stopped = listeners.size
      realtime.start()
      const restarted = listeners.size
      realtime.stop()
      return { started, stopped, restarted, final: listeners.size }
    } finally {
      window.addEventListener = originalAdd
      window.removeEventListener = originalRemove
    }
  })
  expect(counts).toEqual({ started: 1, stopped: 0, restarted: 1, final: 0 })
})

test('StrictMode navigation releases detail subscriptions on repeated mount and unmount', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect(page.locator('.home-page')).toBeVisible()
  await page.evaluate(async () => {
    const { RealtimeSynchronizer } = await import('/src/realtime/synchronizer.ts')
    const original = RealtimeSynchronizer.prototype.setResources
    const observed: Array<{ catalog: boolean; nftIds: string[]; orderIds: string[] }> = []
    Object.assign(window, { observedRealtimeResources: observed })
    RealtimeSynchronizer.prototype.setResources = function (resources) {
      observed.push(structuredClone(resources))
      return original.call(this, resources)
    }
  })
  const latest = () => page.evaluate(() => (window as unknown as { observedRealtimeResources: Array<{ nftIds: string[] }> }).observedRealtimeResources.at(-1)?.nftIds ?? [])
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.evaluate(async () => { await (await import('/src/app/router.tsx')).router.navigate({ href: '/nfts/emerald-ape-042' }) })
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
    await expect.poll(latest).toContain('emerald-ape-042')
    await page.evaluate(async () => { await (await import('/src/app/router.tsx')).router.navigate({ href: '/' }) })
    await expect(page.locator('.home-page')).toBeVisible()
    await expect.poll(latest).not.toContain('emerald-ape-042')
  }
})
