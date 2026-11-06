import { expect, test } from '@playwright/test'

test('default mock reset clears server state and client caches in two tabs', async ({ context, page }) => {
  const other = await context.newPage()
  await Promise.all([page.goto('http://127.0.0.1:5173/'), other.goto('http://127.0.0.1:5173/')])
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect.poll(() => other.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(other.locator('.home-page')).toBeVisible()
  for (const tab of [page, other]) {
    await tab.evaluate(async () => {
      const { queryClient } = await import('/src/app/query-client.ts')
      queryClient.setQueryData(['catalog'], 'old-catalog')
    })
  }
  await other.evaluate(async () => {
    const { createSocket } = await import('/src/realtime/socket.ts')
    const socket = createSocket(location.origin)
    socket.io.reconnection(false)
    const once = (event: string) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 5000)
      socket.once(event, (value) => { clearTimeout(timer); resolve(value) })
    })
    socket.connect()
    await once('connect')
    const ready = once('session.ready')
    socket.emit('session.bind', { visitorId: crypto.randomUUID(), nonce: 'reset-test' })
    await ready
    const subscribed = once('resources.subscribed')
    socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [] })
    await subscribed
    Object.assign(window, { resetTestSocket: socket })
  })
  await page.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
    localStorage.setItem('kurio.order-attempt', 'draft')
    localStorage.setItem('kurio.visitor-id', 'old-visitor')
  })
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/v1/__mock/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'default', clockMode: 'real' }) })
    return { status: response.status, data: await response.json() }
  })
  expect(result.status).toBe(200)
  expect(result.data.generation).toBeTruthy()
  await expect.poll(() => other.evaluate(() => (window as unknown as { resetTestSocket: { connected: boolean } }).resetTestSocket.connected)).toBe(false)
  for (const tab of [page, other]) {
    await expect.poll(() => tab.evaluate(async () => {
      const { queryClient } = await import('/src/app/query-client.ts')
      const { sessionManager } = await import('/src/app/session.ts')
      return { oldCatalog: queryClient.getQueryData(['catalog']) ?? null, privateQueries: queryClient.getQueryCache().getAll().filter((query) => query.meta?.private === true).length, user: sessionManager.session?.userId ?? null }
    })).toEqual({ oldCatalog: null, privateQueries: 0, user: null })
  }
  const storage = await page.evaluate(() => ({ attempt: localStorage.getItem('kurio.order-attempt'), visitor: localStorage.getItem('kurio.visitor-id'), token: localStorage.getItem('kurio.session-token') }))
  expect(storage.attempt).toBeNull()
  expect(storage.token).toBeNull()
  expect(storage.visitor).toBe(result.data.generation)
  const catalog = await page.evaluate(async () => (await fetch('/api/v1/nfts')).json())
  expect(catalog.total).toBe(36)
})
