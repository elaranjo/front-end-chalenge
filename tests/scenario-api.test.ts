import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase } from '../src/mocks/database.ts'
import { readMockClock } from '../src/mocks/mock-clock.ts'
import { controlHandlers } from '../src/mocks/control-handlers.ts'
import { authHandlers } from '../src/mocks/auth-handlers.ts'
import { catalogHandlers } from '../src/mocks/catalog-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { orderHandlers } from '../src/mocks/order-handlers.ts'

test('scenario reset reproduces empty catalog, expired coupon and declined payment', async () => {
  const db = await openMockDatabase('scenario-api')
  const now = async () => (await readMockClock(db)).now
  const server = setupServer(...controlHandlers(db, now), ...authHandlers(db, now), ...catalogHandlers(db), ...cartHandlers(db, now), ...walletHandlers(db, now), ...orderHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  const reset = (scenario: string) => api.post('/__mock/reset', { scenario, clockMode: 'manual', seed: 7 })
  try {
    assert.equal((await reset('empty')).status, 200)
    assert.equal((await api.get('/nfts')).data.total, 0)
    const state = await api.get('/__mock/state')
    assert.equal(state.data.scenario, 'empty')
    assert.equal(state.data.seed, 7)
    assert.equal(JSON.stringify(state.data).includes('password'), false)
    await reset('coupon-expired')
    const coupon = await api.put('/cart/coupon', { code: 'KURIO10' }, { headers: { 'X-Visitor-Id': 'visitor', 'If-Match': '0' } })
    assert.equal(coupon.status, 422)
    assert.equal(coupon.data.error.code, 'COUPON_EXPIRED')
    await reset('payment-declined')
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const headers = { Authorization: `Bearer ${login.data.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await api.put('/wallets/primary', wallet, { headers: { ...headers, 'If-Match': '0' } })
    const connection = await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })
    const cart = await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 1 }, { headers: { ...headers, 'If-Match': '0', 'X-Mutation-Id': 'scenario-add' } })
    const quote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.data.revision }, { headers })
    const collector = { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const order = await api.post('/orders', { quoteId: quote.data.id, quoteFingerprint: quote.data.fingerprint, cartRevision: cart.data.revision, walletId: saved.data.id, provider: 'metamask', network: 'ethereum', connectionId: connection.data.id, collector }, { headers: { ...headers, 'Idempotency-Key': 'scenario-attempt' } })
    assert.equal(order.status, 201)
    await api.post('/__mock/clock', { advanceMs: 2000 })
    assert.equal((await api.get(`/orders/${order.data.id}`, { headers })).data.status, 'declined')
    assert.equal((await api.get('/cart', { headers })).data.lines[0].quantity, 1)
    await reset('payment-declined')
    assert.equal((await api.get('/__mock/state')).data.scenario, 'payment-declined')
    assert.equal((await api.get('/nfts')).data.total, 36)
  } finally { server.close(); db.close() }
})

test('visual fixtures are claimed once and remain stable for the same cart owner', async () => {
  const db = await openMockDatabase('visual-scenarios')
  const server = setupServer(...controlHandlers(db), ...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  try {
    for (const [scenario, total, quantities] of [
      ['visual-desktop', '26.846', [2, 6, 9]],
      ['visual-mobile', '8.156', [1, 1, 2, 2]],
    ] as const) {
      const reset = await api.post('/__mock/reset', { scenario, clockMode: 'manual' })
      const headers = { 'X-Visitor-Id': reset.data.generation }
      const [first, second] = await Promise.all([api.get('/cart', { headers }), api.get('/cart', { headers })])
      assert.deepEqual(first.data.lines.map((line: { quantity: number }) => line.quantity), quantities)
      assert.equal(first.data.quote.total, total)
      assert.deepEqual(first.data.lines, second.data.lines)
      const other = await api.get('/cart', { headers: { 'X-Visitor-Id': 'other-owner' } })
      assert.equal(other.data.lines.length, 0)
      await api.delete(`/cart/items/${first.data.lines[0].lineId}`, { headers: { ...headers, 'If-Match': String(first.data.revision) } })
      assert.equal((await api.get('/cart', { headers })).data.lines.length, quantities.length - 1)
    }
  } finally { server.close(); db.close() }
})

test('sold-out fixture blocks purchase and control-driven scenarios are selectable', async () => {
  const db = await openMockDatabase('event-scenarios')
  const server = setupServer(...controlHandlers(db), ...catalogHandlers(db), ...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    await api.post('/__mock/reset', { scenario: 'sold-out', clockMode: 'manual' })
    const nft = await api.get('/nfts/emerald-ape-042')
    assert.equal(nft.data.editions.find((edition: { id: string }) => edition.id === 'one-of-one').available, 0)
    const add = await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-one', quantity: 1 }, { headers: { 'X-Visitor-Id': 'visitor', 'If-Match': '0', 'X-Mutation-Id': 'sold-out' } })
    assert.equal(add.status, 409)
    assert.equal((await api.get('/cart', { headers: { 'X-Visitor-Id': 'visitor' } })).data.lines.length, 0)
    for (const scenario of ['price-change', 'fee-change', 'pending-disconnect', 'duplicate-old-events']) {
      assert.equal((await api.post('/__mock/reset', { scenario, clockMode: 'manual' })).status, 200)
      assert.equal((await api.get('/__mock/state')).data.scenario, scenario)
    }
  } finally { server.close(); db.close() }
})

test('price and fee control scenarios change the persisted cart quote deterministically', async () => {
  const db = await openMockDatabase('price-fee-scenarios')
  const server = setupServer(...controlHandlers(db), ...catalogHandlers(db), ...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  const headers = { 'X-Visitor-Id': 'visitor', 'If-Match': '0', 'X-Mutation-Id': 'add' }
  const item = { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }
  try {
    await api.post('/__mock/reset', { scenario: 'price-change', clockMode: 'manual' })
    const original = (await api.post('/cart/items', item, { headers })).data
    await api.post('/__mock/actions', { action: 'updateNft', payload: { nftId: item.nftId, editionId: item.editionId, unitPrice: '1.5' } })
    const price = (await api.get('/cart', { headers })).data
    assert.equal(price.quote.total, '3.016')
    assert.notEqual(price.quote.fingerprint, original.quote.fingerprint)
    await api.post('/__mock/reset', { scenario: 'fee-change', clockMode: 'manual' })
    const beforeFee = (await api.post('/cart/items', item, { headers })).data
    await api.post('/__mock/actions', { action: 'updateFee', payload: { amount: '0.03' } })
    const afterFee = (await api.get('/cart', { headers })).data
    assert.equal(afterFee.quote.total, '2.41')
    assert.notEqual(afterFee.quote.fingerprint, beforeFee.quote.fingerprint)
    await api.post('/__mock/reset', { scenario: 'fee-change', clockMode: 'manual' })
    assert.equal((await api.post('/cart/items', item, { headers })).data.quote.total, beforeFee.quote.total)
  } finally { server.close(); db.close() }
})

test('payment-confirmed resolves once and consumes only the purchased cart quantity', async () => {
  const db = await openMockDatabase('scenario-payment-confirmed')
  const now = async () => (await readMockClock(db)).now
  const server = setupServer(...controlHandlers(db, now), ...authHandlers(db, now), ...cartHandlers(db, now), ...walletHandlers(db, now), ...orderHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  try {
    await api.post('/__mock/reset', { scenario: 'payment-confirmed', clockMode: 'manual' })
    const login = (await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })).data
    const headers = { Authorization: `Bearer ${login.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = (await api.put('/wallets/primary', wallet, { headers: { ...headers, 'If-Match': '0' } })).data
    const connection = (await api.post('/wallet-connections', { walletId: saved.id, provider: 'metamask', network: 'ethereum' }, { headers })).data
    const cart = (await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { ...headers, 'If-Match': '0', 'X-Mutation-Id': 'confirmed-add' } })).data
    const quote = (await api.post('/quotes', { walletId: saved.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.revision }, { headers })).data
    const collector = { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const order = (await api.post('/orders', { quoteId: quote.id, quoteFingerprint: quote.fingerprint, cartRevision: cart.revision, walletId: saved.id, provider: 'metamask', network: 'ethereum', connectionId: connection.id, collector }, { headers: { ...headers, 'Idempotency-Key': 'confirmed-order' } })).data
    await api.patch(`/cart/items/${cart.lines[0].lineId}`, { quantity: 3 }, { headers: { ...headers, 'If-Match': String(cart.revision) } })
    await api.post('/__mock/clock', { advanceMs: 2000 })
    const confirmed = (await api.get(`/orders/${order.id}`, { headers })).data
    assert.equal(confirmed.status, 'confirmed')
    assert.equal(confirmed.transaction.simulated, true)
    assert.deepEqual((await api.get(`/orders/${order.id}`, { headers })).data, confirmed)
    assert.equal((await api.get('/cart', { headers })).data.lines[0].quantity, 1)
  } finally { server.close(); db.close() }
})
