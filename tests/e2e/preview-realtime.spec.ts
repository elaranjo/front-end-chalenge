import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('optimized preview exchanges events and reconnects over Socket.IO', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect.poll(() => page.evaluate(async () => (await fetch('/api/v1/__mock/state')).ok)).toBe(true)
  await page.addScriptTag({ path: resolve('node_modules/socket.io-client/dist/socket.io.min.js') })
  const result = await page.evaluate(async () => {
    const io = (window as unknown as { io: (origin: string, options: object) => any }).io
    const socket = io(location.origin, { transports: ['websocket'], upgrade: false, autoConnect: false })
    const once = (event: string) => new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 8000)
      socket.once(event, (value: unknown) => { clearTimeout(timer); resolve(value) })
    })
    const json = async (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
      const response = await fetch(`/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
      return response.json()
    }
    try {
      await json('/__mock/reset', 'POST', { scenario: 'default', clockMode: 'manual' })
      const login = await json('/auth/login', 'POST', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
      const otherLogin = await json('/auth/login', 'POST', { email: 'colecionador.b@kurio.test', password: 'DemoB!2026' })
      const auth = { Authorization: `Bearer ${login.token}` }
      const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
      const saved = await json('/wallets/primary', 'PUT', wallet, { ...auth, 'If-Match': '0' })
      const connection = await json('/wallet-connections', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum' }, auth)
      const cart = await json('/cart/items', 'POST', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 1 }, { ...auth, 'If-Match': '0', 'X-Mutation-Id': 'preview-add' })
      const quote = await json('/quotes', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.revision }, auth)
      socket.connect()
      await once('connect')
      const ready = once('session.ready')
      socket.emit('session.bind', { token: login.token, nonce: 'preview' })
      await ready
      const subscribed = once('resources.subscribed')
      socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [] })
      await subscribed
      const nftChanged = once('nft.updated')
      const collector = { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
      const order = await json('/orders', 'POST', { quoteId: quote.id, quoteFingerprint: quote.fingerprint, cartRevision: cart.revision, walletId: saved.id, provider: 'metamask', network: 'ethereum', connectionId: connection.id, collector }, { ...auth, 'Idempotency-Key': 'preview-order' })
      const nftEvent = await nftChanged
      const orderSubscribed = once('resources.subscribed')
      socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [order.id, 'unknown-order'] })
      const authorizedSubscription = await orderSubscribed
      const orderChanged = once('order.updated')
      await json('/__mock/clock', 'POST', { advanceMs: 2000 })
      const orderEvent = await orderChanged
      const disconnected = once('disconnect')
      const reconnected = once('connect')
      await json('/__mock/actions', 'POST', { action: 'disconnect' })
      await disconnected
      await reconnected
      const rebound = once('session.ready')
      socket.emit('session.bind', { token: login.token, nonce: 'preview-reconnect' })
      await rebound
      const resubscribed = once('resources.subscribed')
      socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [order.id] })
      await resubscribed
      const afterReconnect = once('nft.updated')
      await json('/__mock/actions', 'POST', { action: 'updateNft', payload: { nftId: 'golden-beat-207', editionId: 'one-of-ten', available: 3 } })
      const afterReconnectEvent = await afterReconnect
      const switched = once('session.ready')
      socket.emit('session.bind', { token: otherLogin.token, nonce: 'other-owner' })
      await switched
      const forbiddenSubscription = once('resources.subscribed')
      socket.emit('resources.subscribe', { catalog: false, nftIds: [], orderIds: [order.id] })
      return { nftEvent, orderEvent, authorizedSubscription, forbiddenSubscription: await forbiddenSubscription, afterReconnect: afterReconnectEvent, orderId: order.id, sessionId: login.sessionId, transport: socket.io.engine.transport.name }
    } finally { socket.disconnect() }
  })
  expect(result.nftEvent.resourceId).toBe('emerald-ape-042')
  expect(result.orderEvent.resourceId).toBe(result.orderId)
  expect(result.authorizedSubscription.orderIds).toEqual([result.orderId])
  expect(result.forbiddenSubscription.orderIds).toEqual([])
  expect(result.orderEvent.payload.status).toBe('confirmed')
  expect(result.orderEvent.targetSessionId).toBe(result.sessionId)
  expect(result.afterReconnect.resourceId).toBe('golden-beat-207')
  expect(result.transport).toBe('websocket')
})

test('optimized preview delivers an outbox event to a socket in another tab', async ({ context, page }) => {
  await page.goto('http://127.0.0.1:4173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect.poll(() => page.evaluate(async () => (await fetch('/api/v1/__mock/state')).ok)).toBe(true)
  await page.evaluate(async () => {
    const response = await fetch('/api/v1/__mock/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'default', clockMode: 'manual' }) })
    if (!response.ok) throw new Error(`Reset failed: ${response.status}`)
  })
  const other = await context.newPage()
  try {
    await other.goto('http://127.0.0.1:4173/')
    await expect.poll(() => other.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    await expect.poll(() => other.evaluate(async () => (await fetch('/api/v1/__mock/state')).ok)).toBe(true)
    await other.addScriptTag({ path: resolve('node_modules/socket.io-client/dist/socket.io.min.js') })
    await other.evaluate(async () => {
      const io = (window as unknown as { io: (origin: string, options: object) => any }).io
      const socket = io(location.origin, { transports: ['websocket'], upgrade: false, autoConnect: false })
      const once = (event: string) => new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 8000)
        socket.once(event, () => { clearTimeout(timer); resolve() })
      })
      socket.connect()
      await once('connect')
      const ready = once('session.ready')
      socket.emit('session.bind', { visitorId: crypto.randomUUID(), nonce: 'other-tab' })
      await ready
      const subscribed = once('resources.subscribed')
      socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [] })
      await subscribed
      socket.on('nft.updated', (event: unknown) => { Object.assign(window, { observedNftEvent: event }) })
      Object.assign(window, { testSocket: socket })
    })
    await page.evaluate(async () => {
      const response = await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateNft', payload: { nftId: 'golden-beat-207', editionId: 'one-of-ten', unitPrice: '2.75' } }) })
      if (!response.ok) throw new Error(`Update failed: ${response.status}`)
    })
    await expect.poll(() => other.evaluate(() => (window as unknown as { observedNftEvent?: { resourceId: string } }).observedNftEvent?.resourceId)).toBe('golden-beat-207')
    const price = await other.evaluate(async () => {
      const nft = await (await fetch('/api/v1/nfts/golden-beat-207')).json()
      return nft.editions.find((edition: { id: string }) => edition.id === 'one-of-ten').unitPrice
    })
    expect(price).toBe('2.75')
  } finally { await other.close() }
})
