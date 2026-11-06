import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { openMockDatabase, transact } from '../src/mocks/database.ts'
import { cartQueries } from '../src/shared/cart-queries.ts'
import { EventGate } from '../src/realtime/event-gate.ts'
import { QueryClient } from '@tanstack/react-query'
import type { SessionManager } from '../src/shared/session.ts'
import { cartSchema } from '../src/shared/contracts.ts'

test('a revoked session cannot mutate or merge carts after authentication', async () => {
  const db = await openMockDatabase('cart-revocation-race')
  await initializeCatalog(db)
  await initializeAccounts(db)
  let revokeToken: string | undefined
  let calls = 0
  const now = async () => {
    if (revokeToken && ++calls === 2) {
      const token = revokeToken
      revokeToken = undefined
      await transact(db, ['sessions'], 'readwrite', (tx) => { tx.objectStore('sessions').delete(token) })
    }
    return Date.now()
  }
  const server = setupServer(...authHandlers(db), ...cartHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  const login = async () => (await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })).data.token as string
  const item = { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 1 }
  try {
    await api.post('/cart/items', item, { headers: { 'X-Visitor-Id': 'guest', 'If-Match': '0', 'X-Mutation-Id': 'guest-add' } })
    let token = await login()
    revokeToken = token; calls = 0
    assert.equal((await api.post('/cart/items', item, { headers: { Authorization: `Bearer ${token}`, 'If-Match': '0', 'X-Mutation-Id': 'revoked-add' } })).status, 401)
    token = await login()
    revokeToken = token; calls = 0
    assert.equal((await api.post('/cart/merge', { visitorId: 'guest', mergeKey: 'guest' }, { headers: { Authorization: `Bearer ${token}` } })).status, 401)
    token = await login()
    revokeToken = token; calls = 0
    assert.equal((await api.put('/cart/coupon', { code: 'KURIO10' }, { headers: { Authorization: `Bearer ${token}`, 'If-Match': '0' } })).status, 401)
    token = await login()
    revokeToken = token; calls = 0
    assert.equal((await api.get('/cart', { headers: { Authorization: `Bearer ${token}` } })).status, 401)
    token = await login()
    revokeToken = token; calls = 0
    assert.equal((await api.post('/quotes', { walletId: 'wallet', provider: 'metamask', network: 'ethereum', cartRevision: 0 }, { headers: { Authorization: `Bearer ${token}` } })).status, 401)
    assert.equal((await api.get('/cart', { headers: { 'X-Visitor-Id': 'guest' } })).data.lines.length, 1)
    const validToken = await login()
    const cart = await api.get('/cart', { headers: { Authorization: `Bearer ${validToken}` } })
    assert.equal(cart.data.lines.length, 0)
    assert.equal(cart.data.couponCode, null)
  } finally { server.close(); db.close() }
})

test('REST cart mutations validate identity, revision, stock and idempotency', async () => {
  const db = await openMockDatabase('test-cart-api')
  await initializeCatalog(db)
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    assert.equal((await api.get('/cart')).status, 401)
    const headers = { 'X-Visitor-Id': 'visitor-a', 'If-Match': '0', 'X-Mutation-Id': 'add-1' }
    const item = { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }
    const first = await api.post('/cart/items', item, { headers })
    assert.equal(first.status, 200)
    assert.equal(first.data.quote.total, '2.396')
    const replay = await api.post('/cart/items', item, { headers })
    assert.deepEqual(first.data.lines, replay.data.lines)
    assert.equal(replay.data.revision, 1)
    const view = await api.get('/cart', { headers: { 'X-Visitor-Id': 'visitor-a' } })
    assert.equal(view.data.lines[0].nft.name, 'Emerald Ape #042')
    assert.equal(view.data.quote.subtotal, '2.38')
    assert.equal(view.data.quote.networkFee, '0.016')
    assert.equal(view.data.quote.total, '2.396')
    assert.equal(cartSchema.safeParse(view.data).success, true)
    for (const corrupt of [
      (cart: typeof view.data) => { cart.quote.cartRevision++ },
      (cart: typeof view.data) => { cart.quote.catalogVersion++ },
      (cart: typeof view.data) => { cart.quote.lines[0].quantity++ },
      (cart: typeof view.data) => { cart.quote.lines[0].nftVersion++ },
      (cart: typeof view.data) => { cart.quote.cartId = 'visitor:other' },
    ]) {
      const invalid = structuredClone(view.data)
      corrupt(invalid)
      assert.equal(cartSchema.safeParse(invalid).success, false)
    }
    const coupon = await api.put('/cart/coupon', { code: 'kurio10' }, { headers: { 'X-Visitor-Id': 'visitor-a', 'If-Match': '1' } })
    assert.equal(coupon.data.quote.discount, '0.238')
    assert.equal(coupon.data.quote.total, '2.158')
    const expired = await api.put('/cart/coupon', { code: 'EXPIRADO' }, { headers: { 'X-Visitor-Id': 'visitor-a', 'If-Match': '2' } })
    assert.equal(expired.status, 422)
    assert.equal((await api.get('/cart', { headers: { 'X-Visitor-Id': 'visitor-a' } })).data.couponCode, 'KURIO10')
    const removedCoupon = await api.delete('/cart/coupon', { headers: { 'X-Visitor-Id': 'visitor-a', 'If-Match': '2' } })
    assert.equal(removedCoupon.data.quote.discount, '0')
    assert.equal((await api.post('/cart/items', { ...item, quantity: 3 }, { headers })).status, 409)
    assert.equal((await api.patch(`/cart/items/${first.data.lines[0].lineId}`, { quantity: 11 }, { headers: { ...headers, 'If-Match': '3' } })).status, 409)
    assert.equal((await api.get('/cart', { headers: { Authorization: 'Bearer invalid', 'X-Visitor-Id': 'visitor-a' } })).status, 401)
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const userHeaders = { Authorization: `Bearer ${login.data.token}` }
    const merged = await api.post('/cart/merge', { visitorId: 'visitor-a', mergeKey: 'merge-1' }, { headers: userHeaders })
    assert.equal(merged.data.cart.lines[0].quantity, 2)
    assert.equal(merged.data.cart.quote.total, '2.396')
    const retryMerge = await api.post('/cart/merge', { visitorId: 'visitor-a', mergeKey: 'merge-1' }, { headers: userHeaders })
    assert.deepEqual(retryMerge.data.cart.lines, merged.data.cart.lines)
    assert.deepEqual(retryMerge.data.adjustments, merged.data.adjustments)
    assert.equal((await api.get('/cart', { headers: userHeaders })).data.lines[0].quantity, 2)
    const sessions = { session: login.data, sessionGeneration: 1 } as unknown as SessionManager
    const gate = new EventGate(login.data.userId, login.data.sessionId)
    const query = cartQueries(api, sessions, {} as Storage, () => gate).current()
    assert.equal((await new QueryClient().fetchQuery(query)).lines[0].quantity, 2)
    await transact(db, ['wallets'], 'readwrite', (tx) => { tx.objectStore('wallets').put({ id: 'wallet-a', ownerUserId: 'collector-a', network: 'polygon' }) })
    const quoteRequest = { cartRevision: merged.data.cart.revision, walletId: 'wallet-a', provider: 'coinbase', network: 'polygon' }
    const quote = await api.post('/quotes', quoteRequest, { headers: userHeaders })
    assert.equal(quote.status, 200)
    assert.equal(quote.data.network, 'polygon')
    assert.equal(quote.data.total, '2.396')
    assert.equal((await api.post('/quotes', { ...quoteRequest, cartRevision: 999 }, { headers: userHeaders })).status, 409)
    assert.equal((await api.post('/quotes', { ...quoteRequest, network: 'ethereum' }, { headers: userHeaders })).status, 422)
    assert.equal((await api.post('/quotes', { ...quoteRequest, walletId: 'not-owned' }, { headers: userHeaders })).status, 404)
    const loginB = await api.post('/auth/login', { email: 'colecionador.b@kurio.test', password: 'DemoB!2026' })
    const otherHeaders = { Authorization: `Bearer ${loginB.data.token}` }
    assert.equal((await api.get('/cart', { headers: otherHeaders })).data.lines.length, 0)
    const otherQuote = await api.post('/quotes', { ...quoteRequest, cartRevision: 0 }, { headers: otherHeaders })
    assert.equal(otherQuote.status, 403)
    assert.equal(otherQuote.data.error.code, 'FORBIDDEN')
    assert.equal((await api.get('/cart', { headers: userHeaders })).data.lines[0].quantity, 2)
    const retryHeaders = { 'X-Visitor-Id': 'visitor-retry' }
    const created = await api.post('/cart/items', item, { headers: { ...retryHeaders, 'If-Match': '0', 'X-Mutation-Id': 'retry-add' } })
    const lineId = created.data.lines[0].lineId
    const update = await api.patch(`/cart/items/${lineId}`, { quantity: 3 }, { headers: { ...retryHeaders, 'If-Match': '1' } })
    const repeatedUpdate = await api.patch(`/cart/items/${lineId}`, { quantity: 3 }, { headers: { ...retryHeaders, 'If-Match': '1' } })
    assert.equal(repeatedUpdate.status, 200)
    assert.equal(repeatedUpdate.data.revision, update.data.revision)
    await api.delete(`/cart/items/${lineId}`, { headers: { ...retryHeaders, 'If-Match': '2' } })
    const recreated = await api.post('/cart/items', item, { headers: { ...retryHeaders, 'If-Match': '3', 'X-Mutation-Id': 'retry-new-line' } })
    const repeatedDelete = await api.delete(`/cart/items/${lineId}`, { headers: { ...retryHeaders, 'If-Match': '2' } })
    assert.equal(repeatedDelete.status, 200)
    assert.equal(repeatedDelete.data.revision, recreated.data.revision)
    assert.equal(repeatedDelete.data.lines[0].lineId, recreated.data.lines[0].lineId)
  } finally { server.close(); db.close() }
})
