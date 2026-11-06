import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { orderHandlers } from '../src/mocks/order-handlers.ts'
import { controlHandlers } from '../src/mocks/control-handlers.ts'
import { CheckoutSubmission } from '../src/shared/checkout-submission.ts'
import { CheckoutQuoteClient } from '../src/shared/checkout-quote.ts'
import { OrderAttemptManager } from '../src/shared/order-attempt.ts'
import type { SessionManager } from '../src/shared/session.ts'
import { EventGate } from '../src/realtime/event-gate.ts'

test('price and fee changes each require a fresh review before an order can be created', async () => {
  const db = await openMockDatabase('checkout-integration')
  await initializeCatalog(db)
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...cartHandlers(db), ...walletHandlers(db), ...orderHandlers(db), ...controlHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } as Storage
  try {
    const session = (await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })).data
    const headers = { Authorization: `Bearer ${session.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = (await api.put('/wallets/primary', wallet, { headers: { ...headers, 'If-Match': '0' } })).data
    const connection = (await api.post('/wallet-connections', { walletId: saved.id, provider: 'metamask', network: 'ethereum' }, { headers })).data
    const cart = (await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { ...headers, 'If-Match': '0', 'X-Mutation-Id': 'review-add' } })).data
    const sessions = { session, sessionGeneration: 1 } as unknown as SessionManager
    const gate = new EventGate(session.userId, 'session')
    const quoteClient = new CheckoutQuoteClient(api, sessions, () => gate)
    const { quote: reviewed, checkedAt } = await quoteClient.fetch({ walletId: saved.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.revision })
    assert.ok(Number.isFinite(checkedAt))
    const collector = { displayName: 'A', username: 'a', network: 'ethereum' as const, profileName: 'A', address: wallet.address, walletType: 'metamask' as const, referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const selection = { walletId: saved.id, provider: 'metamask' as const, network: 'ethereum' as const, collector }
    const attempts = new OrderAttemptManager(api, sessions, storage)
    const checkout = new CheckoutSubmission(api, sessions, attempts, () => true, () => gate)
    await api.post('/__mock/actions', { action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-ten', unitPrice: '1.50' } })
    await assert.rejects(attempts.create({ ...selection, quoteId: reviewed.id, quoteFingerprint: reviewed.fingerprint, cartRevision: reviewed.cartRevision, connectionId: connection.id }), (error: unknown) => axios.isAxiosError(error) && error.response?.data?.error?.code === 'STALE_QUOTE')
    assert.equal(attempts.hasAttempt(), false)
    const price = await checkout.submit(reviewed, selection, connection)
    assert.equal(price.status, 'review-required')
    if (price.status !== 'review-required') throw new Error('Expected price review')
    assert.equal(price.current.subtotal, '3')
    assert.equal(attempts.hasAttempt(), false)
    await api.post('/__mock/actions', { action: 'updateFee', payload: { amount: '0.03' } })
    const fee = await checkout.submit(price.current, selection, connection)
    assert.equal(fee.status, 'review-required')
    if (fee.status !== 'review-required') throw new Error('Expected fee review')
    assert.equal(fee.current.total, '3.03')
    assert.equal(attempts.hasAttempt(), false)
    const submitted = await checkout.submit(fee.current, selection, connection)
    assert.equal(submitted.status, 'submitted')
    if (submitted.status !== 'submitted') throw new Error('Expected submitted order')
    assert.equal(submitted.order.status, 'pending')
    assert.equal(submitted.order.snapshot.quote.total, '3.03')
    assert.equal(attempts.hasAttempt(), true)
  } finally { server.close(); db.close() }
})
