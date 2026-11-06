import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('a pending order resolves during disconnection and is recovered without another purchase', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect.poll(() => page.evaluate(async () => (await fetch('/api/v1/__mock/state')).ok)).toBe(true)
  await page.addScriptTag({ path: resolve('node_modules/socket.io-client/dist/socket.io.min.js') })
  const result = await page.evaluate(async () => {
    const json = async (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
      const response = await fetch(`/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (!response.ok) throw new Error(`${path}: ${response.status}`)
      return response.json()
    }
    const io = (window as unknown as { io: (origin: string, options: object) => any }).io
    const socket = io(location.origin, { transports: ['websocket'], upgrade: false, autoConnect: false, reconnection: false })
    const once = (event: string) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 8000)
      socket.once(event, () => { clearTimeout(timer); resolve() })
    })
    try {
      await json('/__mock/reset', 'POST', { scenario: 'pending-disconnect', clockMode: 'manual' })
      const login = await json('/auth/login', 'POST', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
      const auth = { Authorization: `Bearer ${login.token}` }
      const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
      const saved = await json('/wallets/primary', 'PUT', wallet, { ...auth, 'If-Match': '0' })
      const connection = await json('/wallet-connections', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum' }, auth)
      const cart = await json('/cart/items', 'POST', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { ...auth, 'If-Match': '0', 'X-Mutation-Id': 'offline-add' })
      const quote = await json('/quotes', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.revision }, auth)
      const collector = { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
      const payload = { quoteId: quote.id, quoteFingerprint: quote.fingerprint, cartRevision: cart.revision, walletId: saved.id, provider: 'metamask', network: 'ethereum', connectionId: connection.id, collector }
      const key = 'offline-order'
      socket.connect()
      await once('connect')
      const ready = once('session.ready')
      socket.emit('session.bind', { token: login.token, nonce: 'before-offline' })
      await ready
      const order = await json('/orders', 'POST', payload, { ...auth, 'Idempotency-Key': key })
      const disconnected = once('disconnect')
      await json('/__mock/actions', 'POST', { action: 'disconnect' })
      await disconnected
      await json('/__mock/clock', 'POST', { advanceMs: 2000 })
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('kurio-mock')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      let storedStatus = 'pending'
      try {
        for (let attempt = 0; attempt < 100 && storedStatus === 'pending'; attempt++) {
          storedStatus = await new Promise<string>((resolve, reject) => {
            const tx = db.transaction('orders')
            const request = tx.objectStore('orders').get(order.id)
            tx.oncomplete = () => resolve(request.result.status)
            tx.onabort = () => reject(tx.error)
          })
          if (storedStatus === 'pending') await new Promise((resolve) => setTimeout(resolve, 20))
        }
      } finally { db.close() }
      if (storedStatus !== 'confirmed') throw new Error('Order did not resolve while disconnected')
      const recovered = await json(`/orders/attempts/${key}`, 'GET', undefined, auth)
      const retry = await json('/orders', 'POST', payload, { ...auth, 'Idempotency-Key': key })
      const nft = await json('/nfts/emerald-ape-042')
      const remaining = await json('/cart', 'GET', undefined, auth)
      socket.connect()
      await once('connect')
      const rebound = once('session.ready')
      socket.emit('session.bind', { token: login.token, nonce: 'after-offline' })
      await rebound
      localStorage.setItem('kurio.order-attempt', 'old-attempt')
      localStorage.setItem('kurio.checkout-draft', 'old-draft')
      await json('/__mock/reset', 'POST', { scenario: 'default', clockMode: 'manual' })
      const resetDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('kurio-mock')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const counts = await new Promise<number[]>((resolve, reject) => {
        const tx = resetDb.transaction(['orders', 'reservations', 'ledger', 'carts', 'sessions', 'outbox'])
        const requests = ['orders', 'reservations', 'ledger', 'carts', 'sessions', 'outbox'].map((store) => tx.objectStore(store).count())
        tx.oncomplete = () => resolve(requests.map((request) => request.result))
        tx.onabort = () => reject(tx.error)
      })
      resetDb.close()
      const sessionStatus = (await fetch('/api/v1/auth/session', { headers: auth })).status
      const restored = await json('/nfts/emerald-ape-042')
      return { initial: order.id, initialStatus: order.status, recovered: recovered.id, status: recovered.status, retry: retry.id, available: nft.editions.find((edition: { id: string }) => edition.id === 'one-of-ten').available, cartLines: remaining.lines.length, counts, sessionStatus, restoredStock: restored.editions.find((edition: { id: string }) => edition.id === 'one-of-ten').available, attempt: localStorage.getItem('kurio.order-attempt'), draft: localStorage.getItem('kurio.checkout-draft') }
    } finally { socket.disconnect() }
  })
  expect(result.initialStatus).toBe('pending')
  expect(result.recovered).toBe(result.initial)
  expect(result.retry).toBe(result.initial)
  expect(result.status).toBe('confirmed')
  expect(result.available).toBe(8)
  expect(result.cartLines).toBe(0)
  expect(result.counts).toEqual([0, 0, 0, 0, 0, 0])
  expect(result.sessionStatus).toBe(401)
  expect(result.restoredStock).toBe(10)
  expect(result.attempt).toBeNull()
  expect(result.draft).toBeNull()
})
