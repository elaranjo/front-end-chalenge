import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { type AxiosAdapter } from 'axios'
import { setupServer } from 'msw/node'
import { QueryClient } from '@tanstack/react-query'
import { openMockDatabase } from '../src/mocks/database.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { CartClient } from '../src/shared/cart-client.ts'
import { EventGate } from '../src/realtime/event-gate.ts'
import type { SessionManager } from '../src/shared/session.ts'

test('cart client sends stable mutations and reconciles its visitor cache', async () => {
  const db = await openMockDatabase('cart-client')
  await initializeCatalog(db)
  const server = setupServer(...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const data = new Map<string, string>([['kurio.visitor-id', 'visitor']])
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } } as Storage
  const cache = new QueryClient()
  const session = { session: null, sessionGeneration: 0 } as unknown as SessionManager
  const client = new CartClient(axios.create({ baseURL: 'http://localhost/api/v1' }), cache, session, storage, () => newGate)
  const newGate = new EventGate(null, 'visitor')
  try {
    const input = { nftId: 'emerald-ape-042', editionId: 'one-of-ten' as const, quantity: 2, mutationId: 'operation-1' }
    const first = await client.add(input, 0)
    assert.equal((await client.add(input, 0)).lines[0].quantity, 2)
    const changed = await client.change(first.lines[0].lineId, 3, first.revision)
    const coupon = await client.applyCoupon('KURIO10', changed.revision)
    assert.equal(coupon.quote?.discount, '0.357')
    await assert.rejects(client.change(first.lines[0].lineId, 11, coupon.revision))
    assert.equal(cache.getQueryState(['cart', 'visitor:visitor', 0])?.isInvalidated, true)
    const withoutCoupon = await client.removeCoupon(coupon.revision)
    const empty = await client.remove(first.lines[0].lineId, withoutCoupon.revision)
    assert.equal(empty.lines.length, 0)
    assert.deepEqual(cache.getQueryData(['cart', 'visitor:visitor', 0]), empty)
  } finally { server.close(); db.close() }
})

test('an ambiguous mutation blocks further writes until the cart is reconciled', async () => {
  const db = await openMockDatabase('cart-client-ambiguous')
  await initializeCatalog(db)
  const server = setupServer(...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  let loseResponse = true
  api.interceptors.response.use((response) => {
    if (loseResponse && response.config.url === '/cart/items') { loseResponse = false; throw new axios.AxiosError('lost response', 'ERR_NETWORK') }
    return response
  })
  const data = new Map<string, string>([['kurio.visitor-id', 'visitor']])
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } } as Storage
  const sessions = { session: null, sessionGeneration: 0 } as unknown as SessionManager
  const gate = new EventGate(null, 'visitor')
  const client = new CartClient(api, new QueryClient(), sessions, storage, () => gate)
  try {
    const input = { nftId: 'emerald-ape-042', editionId: 'one-of-ten' as const, quantity: 2, mutationId: 'lost-add' }
    await assert.rejects(client.add(input, 0), /lost response/)
    await assert.rejects(client.add(input, 0), /Reconcile/)
    const actual = await client.reconcile()
    assert.equal(actual.lines[0].quantity, 2)
    assert.equal(actual.revision, 1)
    const retried = await client.add(input, 0)
    assert.equal(retried.lines[0].quantity, 2)
    assert.equal(retried.revision, 1)
  } finally { server.close(); db.close() }
})

test('a late cart mutation response cannot populate another account cache', async () => {
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: { id: 'user:a', ownerKind: 'user', revision: 1, catalogVersion: 1, lines: [], couponCode: null, quote: null, adjustments: [] }, status: 200, statusText: 'OK', headers: {}, config })
  })
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const cache = new QueryClient()
  let gate = new EventGate('a', 'session-a')
  const client = new CartClient(axios.create({ adapter }), cache, state as unknown as SessionManager, {} as Storage, () => gate)
  const request = client.remove('line', 0)
  await new Promise((resolve) => setImmediate(resolve))
  state.session = { token: 'b', userId: 'b' }; state.sessionGeneration = 2
  gate = new EventGate('b', 'session-b')
  cache.clear()
  release()
  await assert.rejects(request, /Session changed/)
  assert.equal(cache.getQueryData(['cart', 'user:a', 1]), undefined)
  assert.equal(cache.getQueryData(['cart', 'user:b', 2]), undefined)
})
