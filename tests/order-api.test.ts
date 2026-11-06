import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase, transact } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { orderHandlers } from '../src/mocks/order-handlers.ts'
import { orderSchema, quoteSchema } from '../src/shared/contracts.ts'
import { OrderAttemptManager } from '../src/shared/order-attempt.ts'
import type { SessionManager } from '../src/shared/session.ts'
import { advanceMockClock, readMockClock } from '../src/mocks/mock-clock.ts'
import { startOrderScheduler } from '../src/mocks/order-scheduler.ts'
import { notifyOutbox } from '../src/mocks/outbox-bridge.ts'
import { QueryClient } from '@tanstack/react-query'
import { privateQueries, StaleOrderResponse } from '../src/shared/private-queries.ts'
import { EventGate } from '../src/realtime/event-gate.ts'

test('order creation cannot reserve stock after session revocation', async () => {
  const db = await openMockDatabase('order-revocation-race')
  await initializeCatalog(db)
  await initializeAccounts(db)
  let tokenToRevoke: string | undefined
  let calls = 0
  const now = async () => {
    if (tokenToRevoke && ++calls === 2) {
      const token = tokenToRevoke
      tokenToRevoke = undefined
      await transact(db, ['sessions'], 'readwrite', (tx) => { tx.objectStore('sessions').delete(token) })
    }
    return Date.now()
  }
  const server = setupServer(...authHandlers(db), ...cartHandlers(db), ...walletHandlers(db), ...orderHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const headers = { Authorization: `Bearer ${login.data.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await api.put('/wallets/primary', wallet, { headers: { ...headers, 'If-Match': '0' } })
    const connection = await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })
    const cart = await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { ...headers, 'If-Match': '0', 'X-Mutation-Id': 'race-add' } })
    const quote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.data.revision }, { headers })
    const collector = { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    tokenToRevoke = login.data.token
    calls = 0
    const result = await api.post('/orders', { quoteId: quote.data.id, quoteFingerprint: quote.data.fingerprint, cartRevision: cart.data.revision, walletId: saved.data.id, provider: 'metamask', network: 'ethereum', connectionId: connection.data.id, collector }, { headers: { ...headers, 'Idempotency-Key': 'race-order' } })
    assert.equal(result.status, 401)
    assert.equal(result.data.error.code, 'SESSION_INVALID')
    const counts = await new Promise<number[]>((resolve, reject) => {
      const tx = db.transaction(['orders', 'reservations', 'ledger', 'catalog'])
      const orders = tx.objectStore('orders').count()
      const reservations = tx.objectStore('reservations').count()
      const ledger = tx.objectStore('ledger').count()
      const nft = tx.objectStore('catalog').get('emerald-ape-042')
      tx.oncomplete = () => resolve([orders.result, reservations.result, ledger.result, nft.result.editions.find((entry: { id: string }) => entry.id === 'one-of-ten').available])
      tx.onabort = () => reject(tx.error)
    })
    assert.deepEqual(counts, [0, 0, 1, 10]) // one ledger entry belongs to the earlier cart mutation
  } finally { server.close(); db.close() }
})

test('REST recovers one purchase by key and resolves it after reload or reconnect', async () => {
  const db = await openMockDatabase('test-order-api')
  await initializeCatalog(db); await initializeAccounts(db)
  await transact(db, ['scenario'], 'readwrite', (tx) => { tx.objectStore('scenario').put({ id: 'mock-clock', mode: 'manual', now: Date.now() }) })
  const now = async () => (await readMockClock(db)).now
  const server = setupServer(...authHandlers(db, now), ...cartHandlers(db, now), ...walletHandlers(db, now), ...orderHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const stopScheduler = await startOrderScheduler(db)
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    const a = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const b = await api.post('/auth/login', { email: 'colecionador.b@kurio.test', password: 'DemoB!2026' })
    const headers = { Authorization: `Bearer ${a.data.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await api.put('/wallets/primary', wallet, { headers: { ...headers, 'If-Match': '0' } })
    const connection = await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })
    const cart = await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { ...headers, 'If-Match': '0', 'X-Mutation-Id': 'add' } })
    const quote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.data.revision }, { headers })
    assert.equal(Date.parse(quote.data.expiresAt) - Date.parse(quote.headers['x-server-time']), 60_000)
    assert.equal(quoteSchema.safeParse(quote.data).success, true)
    assert.equal(quoteSchema.safeParse({ ...quote.data, total: '0' }).success, false)
    assert.equal(quoteSchema.safeParse({ ...quote.data, total: 'invalid' }).success, false)
    const payload = { quoteId: quote.data.id, quoteFingerprint: quote.data.fingerprint, cartRevision: cart.data.revision, walletId: saved.data.id, provider: 'metamask', network: 'ethereum', connectionId: connection.data.id, collector: { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' } }
    const otherSession = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const unauthorizedConnection = await api.post('/orders', payload, { headers: { Authorization: `Bearer ${otherSession.data.token}`, 'Idempotency-Key': 'other-session' } })
    assert.equal(unauthorizedConnection.status, 409)
    assert.equal(unauthorizedConnection.data.error.code, 'CONNECTION_INVALID')
    const orderHeaders = { ...headers, 'Idempotency-Key': 'attempt-1' }
    const first = await api.post('/orders', payload, { headers: orderHeaders })
    assert.equal(first.status, 201)
    assert.equal(first.data.status, 'pending')
    assert.equal(orderSchema.safeParse(first.data).success, true)
    assert.equal(orderSchema.safeParse({ ...first.data, status: 'confirmed' }).success, false)
    assert.equal(first.data.resolveAt, undefined)
    assert.equal((await api.post('/orders', payload, { headers: orderHeaders })).data.id, first.data.id)
    assert.equal((await api.get(`/orders/${first.data.id}`, { headers: { Authorization: `Bearer ${b.data.token}` } })).status, 403)
    assert.equal((await api.get('/orders/nonexistent', { headers })).status, 404)
    await advanceMockClock(db, 2500)
    notifyOutbox()
    let status = 'pending'
    for (let attempt = 0; attempt < 100 && status === 'pending'; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      status = await new Promise<string>((resolve, reject) => {
        const tx = db.transaction('orders', 'readonly')
        const request = tx.objectStore('orders').get(first.data.id)
        tx.oncomplete = () => resolve(request.result.status)
        tx.onabort = () => reject(tx.error)
      })
    }
    assert.equal(status, 'confirmed')
    const recovered = await api.get('/orders/attempts/attempt-1', { headers })
    assert.equal(recovered.data.status, 'confirmed')
    assert.equal(recovered.data.transaction.simulated, true)
    assert.equal(orderSchema.safeParse(recovered.data).success, true)
    assert.equal(orderSchema.safeParse({ ...recovered.data, status: 'pending' }).success, false)
    const gate = new EventGate('collector-a', a.data.sessionId)
    const fakeSession = { session: a.data, sessionGeneration: 1 } as unknown as SessionManager
    const orderQuery = privateQueries(api, fakeSession, () => gate).order(first.data.id)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    assert.equal((await queryClient.fetchQuery(orderQuery)).status, 'confirmed')
    assert.equal(gate.observeOrder(first.data.id, recovered.data.version + 1, 'confirmed'), true)
    await assert.rejects(queryClient.fetchQuery(orderQuery), StaleOrderResponse)
    assert.equal((await api.get('/cart', { headers })).data.lines.length, 0)
  } finally { stopScheduler(); server.close(); db.close() }
})

test('a committed order remains recoverable with the original attempt after a lost response', async () => {
  const db = await openMockDatabase('test-order-attempt-recovery')
  await initializeCatalog(db)
  await initializeAccounts(db)
  await transact(db, ['scenario'], 'readwrite', (tx) => { tx.objectStore('scenario').put({ id: 'mock-clock', mode: 'manual', now: Date.now() }) })
  const now = async () => (await readMockClock(db)).now
  const server = setupServer(...authHandlers(db, now), ...cartHandlers(db, now), ...walletHandlers(db, now), ...orderHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } } as Storage
  try {
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const headers = { Authorization: `Bearer ${login.data.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await api.put('/wallets/primary', wallet, { headers: { ...headers, 'If-Match': '0' } })
    const connection = await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })
    const cart = await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { ...headers, 'If-Match': '0', 'X-Mutation-Id': 'add' } })
    const quote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.data.revision }, { headers })
    const payload = { quoteId: quote.data.id, quoteFingerprint: quote.data.fingerprint, cartRevision: cart.data.revision, walletId: saved.data.id, provider: 'metamask' as const, network: 'ethereum' as const, connectionId: connection.data.id, collector: { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' } }
    const state = { session: login.data, sessionGeneration: 1 } as unknown as SessionManager
    await transact(db, ['scenario'], 'readwrite', (tx) => { tx.objectStore('scenario').put({ id: 'scenario-config', name: 'timeout-after-order-create', seed: 0 }) })
    api.defaults.timeout = 150
    const manager = new OrderAttemptManager(api, state, storage)
    const pending = manager.create(payload)
    const duplicate = manager.create(payload)
    assert.equal(duplicate, pending)
    assert.equal(manager.hasAttempt(), true)
    await assert.rejects(pending, (error: unknown) => axios.isAxiosError(error) && error.code === 'ECONNABORTED')
    const afterRefresh = new OrderAttemptManager(api, state, storage)
    const recovered = await afterRefresh.recover()
    const retried = await afterRefresh.retry()
    assert.equal(recovered.id, retried.id)
    assert.equal(recovered.status, 'pending')
    assert.equal((await api.get('/cart', { headers })).data.lines[0].quantity, 2)
    await advanceMockClock(db, 2000)
    const confirmed = await afterRefresh.recover()
    assert.equal(confirmed.id, recovered.id)
    assert.equal(confirmed.status, 'confirmed')
    assert.equal((await afterRefresh.retry()).id, confirmed.id)
    assert.equal((await api.get('/cart', { headers })).data.lines.length, 0)
    const records = await new Promise<{ orders: any[]; ledger: any[]; reservations: any[] }>((resolve, reject) => {
      const tx = db.transaction(['orders', 'ledger', 'reservations'])
      const orders = tx.objectStore('orders').getAll()
      const ledger = tx.objectStore('ledger').getAll()
      const reservations = tx.objectStore('reservations').getAll()
      tx.oncomplete = () => resolve({ orders: orders.result, ledger: ledger.result, reservations: reservations.result })
      tx.onabort = () => reject(tx.error)
    })
    assert.equal(records.orders.length, 1)
    assert.equal(records.ledger.filter((item) => item.id === `order-effect:${confirmed.id}`).length, 1)
    assert.equal(records.reservations.length, 0)
  } finally { server.close(); db.close() }
})
