import { expect, test } from '@playwright/test'

test('real Socket.IO receives catalog and authorized order changes from REST commits', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const json = async (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
      const response = await fetch(`/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
      return response.json()
    }
    await json('/__mock/reset', 'POST', { scenario: 'duplicate-old-events', clockMode: 'real' })
    const login = await json('/auth/login', 'POST', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const auth = { Authorization: `Bearer ${login.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await json('/wallets/primary', 'PUT', wallet, { ...auth, 'If-Match': '0' })
    const connection = await json('/wallet-connections', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum' }, auth)
    const cart = await json('/cart/items', 'POST', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { ...auth, 'If-Match': '0', 'X-Mutation-Id': 'realtime-add' })
    const { createSocket } = await import('/src/realtime/socket.ts')
    const socket = createSocket(location.origin)
    const once = (event: string) => new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 6000)
      socket.once(event, (value) => { clearTimeout(timer); resolve(value) })
    })
    try {
      socket.connect()
      await once('connect')
      const ready = once('session.ready')
      socket.emit('session.bind', { token: login.token, nonce: 'test-generation' })
      await ready
      const subscribed = once('resources.subscribed')
      socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [] })
      await subscribed
      const controlledEvent = once('nft.updated')
      await json('/__mock/actions', 'POST', { action: 'updateNft', payload: { nftId: 'golden-beat-207', editionId: 'one-of-ten', unitPrice: '2.5', available: 3 } })
      const controlled = await controlledEvent
      const controlledRest = await json('/nfts/golden-beat-207')
      const { EventGate } = await import('/src/realtime/event-gate.ts')
      const gate = new EventGate(login.userId, login.sessionId)
      const accepted = Boolean(gate.accept(controlled))
      const duplicateEvent = once('nft.updated')
      await json('/__mock/actions', 'POST', { action: 'emitDuplicate', payload: { eventId: controlled.eventId } })
      const duplicate = await duplicateEvent
      const olderEvent = once('nft.updated')
      await json('/__mock/actions', 'POST', { action: 'emitOlder', payload: { eventId: controlled.eventId } })
      const older = await olderEvent
      const replayCheck = { accepted, duplicateId: duplicate.eventId, duplicateAccepted: Boolean(gate.accept(duplicate)), olderVersion: older.version, olderAccepted: Boolean(gate.accept(older)), rest: await json('/nfts/golden-beat-207') }
      // A catalog update invalidates the earlier quote, so request a fresh one.
      const freshQuote = await json('/quotes', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.revision }, auth)
      const changed = once('nft.updated')
      const payload = { quoteId: freshQuote.id, quoteFingerprint: freshQuote.fingerprint, cartRevision: cart.revision, walletId: saved.id, provider: 'metamask', network: 'ethereum', connectionId: connection.id, collector: { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' } }
      const order = await json('/orders', 'POST', payload, { ...auth, 'Idempotency-Key': 'realtime-order' })
      const nftEvent = await changed
      const orderSubscription = once('resources.subscribed')
      socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [order.id] })
      await orderSubscription
      const updated = once('order.updated')
      await new Promise((resolve) => setTimeout(resolve, 2100))
      const recovered = await json(`/orders/${order.id}`, 'GET', undefined, auth)
      const orderEvent = await updated
      return { nftEvent, orderEvent, recovered, controlled, controlledRest, replayCheck, sessionId: login.sessionId }
    } finally { socket.disconnect() }
  })
  expect(result.nftEvent.resourceId).toBe('emerald-ape-042')
  expect(result.controlled.resourceId).toBe('golden-beat-207')
  expect(result.controlled.version).toBe(result.controlledRest.version)
  expect(result.replayCheck.accepted).toBe(true)
  expect(result.replayCheck.duplicateId).toBe(result.controlled.eventId)
  expect(result.replayCheck.duplicateAccepted).toBe(false)
  expect(result.replayCheck.olderVersion).toBe(result.controlled.version - 1)
  expect(result.replayCheck.olderAccepted).toBe(false)
  expect(result.replayCheck.rest).toEqual(result.controlledRest)
  expect(result.orderEvent.payload.status).toBe('confirmed')
  expect(result.orderEvent.targetSessionId).toBe(result.sessionId)
  expect(result.recovered.status).toBe('confirmed')
})

test('rebinding a socket discards the previous catalog subscription', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const received = await page.evaluate(async () => {
    const { createSocket } = await import('/src/realtime/socket.ts')
    const socket = createSocket(location.origin)
    const once = (event: string) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 6000)
      socket.once(event, () => { clearTimeout(timer); resolve() })
    })
    try {
      socket.connect()
      await once('connect')
      let ready = once('session.ready')
      socket.emit('session.bind', { visitorId: crypto.randomUUID(), nonce: 'first' })
      await ready
      const subscribed = once('resources.subscribed')
      socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [] })
      await subscribed
      ready = once('session.ready')
      socket.emit('session.bind', { visitorId: crypto.randomUUID(), nonce: 'second' })
      await ready
      let count = 0
      socket.on('nft.updated', () => { count++ })
      const response = await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateNft', payload: { nftId: 'golden-beat-207', editionId: 'one-of-ten', unitPrice: '2.5' } }) })
      if (!response.ok) throw new Error(`Update failed: ${response.status}`)
      await new Promise((resolve) => setTimeout(resolve, 300))
      return count
    } finally { socket.disconnect() }
  })
  expect(received).toBe(0)
})

test('technical disconnect closes the real transport and permits reconnection', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const { createSocket } = await import('/src/realtime/socket.ts')
    const socket = createSocket(location.origin)
    const once = (event: string) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 8000)
      socket.once(event, () => { clearTimeout(timer); resolve() })
    })
    try {
      socket.connect()
      await once('connect')
      const disconnected = once('disconnect')
      const reconnected = once('connect')
      const response = await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) })
      if (!response.ok) throw new Error(`Disconnect failed: ${response.status}`)
      await disconnected
      await reconnected
      return socket.connected
    } finally { socket.disconnect() }
  })
  expect(result).toBe(true)
})
