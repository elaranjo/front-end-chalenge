import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { openMockDatabase } from '../src/mocks/database.ts'
import { SessionManager } from '../src/shared/session.ts'
import { AuthFlow, CartMergePending } from '../src/shared/auth-flow.ts'
import { PENDING_MERGE_KEY, visitorId } from '../src/shared/visitor-cart.ts'

test('login keeps the authenticated session and guest cart after a failed merge, then resumes', async () => {
  const db = await openMockDatabase('test-auth-flow')
  await initializeCatalog(db)
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } } as Storage
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  const session = new SessionManager(api, new QueryClient(), storage)
  const flow = new AuthFlow(session, api, storage)
  try {
    const guest = visitorId(storage)
    await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { 'X-Visitor-Id': guest, 'If-Match': '0', 'X-Mutation-Id': '1' } })
    server.use(http.post('*/api/v1/cart/merge', () => HttpResponse.error(), { once: true }))
    await assert.rejects(flow.login('colecionador.a@kurio.test', 'DemoA!2026'), CartMergePending)
    assert.equal(session.session?.userId, 'collector-a')
    assert.equal(visitorId(storage), guest)
    assert.equal(JSON.parse(storage.getItem(PENDING_MERGE_KEY)!).visitorId, guest)
    const restoredSession = new SessionManager(api, new QueryClient(), storage)
    await restoredSession.restore()
    const restoredFlow = new AuthFlow(restoredSession, api, storage)
    assert.equal(restoredFlow.hasPendingMerge(), true)
    const resumed = await restoredFlow.retryMerge()
    assert.equal(restoredFlow.hasPendingMerge(), false)
    assert.equal(storage.getItem(PENDING_MERGE_KEY), null)
    assert.equal(resumed.cart.lines[0].quantity, 2)
    assert.notEqual(visitorId(storage), guest)
  } finally { server.close(); db.close() }
})

test('a different account cannot merge a pending visitor cart left by the previous owner', async () => {
  const db = await openMockDatabase('test-auth-flow-account-switch')
  await initializeCatalog(db)
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } } as Storage
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  const session = new SessionManager(api, new QueryClient(), storage)
  const flow = new AuthFlow(session, api, storage)
  try {
    const guest = visitorId(storage)
    await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { 'X-Visitor-Id': guest, 'If-Match': '0', 'X-Mutation-Id': '1' } })
    server.use(http.post('*/api/v1/cart/merge', () => HttpResponse.error(), { once: true }))
    await assert.rejects(flow.login('colecionador.a@kurio.test', 'DemoA!2026'), CartMergePending)
    await session.clear()
    const second = await flow.login('colecionador.b@kurio.test', 'DemoB!2026')
    assert.equal(second.cart.lines.length, 0)
    assert.notEqual(visitorId(storage), guest)
    const original = await api.get('/cart', { headers: { 'X-Visitor-Id': guest } })
    assert.equal(original.data.lines[0].quantity, 2)
  } finally { server.close(); db.close() }
})
