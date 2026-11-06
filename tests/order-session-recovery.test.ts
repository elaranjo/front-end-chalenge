import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { type AxiosAdapter } from 'axios'
import { setupServer } from 'msw/node'
import { QueryClient } from '@tanstack/react-query'
import { openMockDatabase } from '../src/mocks/database.ts'
import { authHandlers } from '../src/mocks/auth-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { orderHandlers } from '../src/mocks/order-handlers.ts'
import { controlHandlers } from '../src/mocks/control-handlers.ts'
import { readMockClock } from '../src/mocks/mock-clock.ts'
import { SessionManager } from '../src/shared/session.ts'
import { ORDER_ATTEMPT_KEY, OrderAttemptManager } from '../src/shared/order-attempt.ts'

test('a timed-out order survives session expiry and resumes under the same account', async () => {
  const db = await openMockDatabase('order-session-recovery')
  const now = async () => (await readMockClock(db)).now
  const server = setupServer(...controlHandlers(db, now), ...authHandlers(db, now), ...cartHandlers(db, now), ...walletHandlers(db, now), ...orderHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } as Storage
  try {
    await api.post('/__mock/reset', { scenario: 'timeout-after-order-create', clockMode: 'manual' })
    const sessions = new SessionManager(api, new QueryClient(), storage)
    const session = await sessions.login('colecionador.a@kurio.test', 'DemoA!2026')
    assert.ok(session)
    const headers = { Authorization: `Bearer ${session.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = (await api.put('/wallets/primary', wallet, { headers: { ...headers, 'If-Match': '0' } })).data
    const connection = (await api.post('/wallet-connections', { walletId: saved.id, provider: 'metamask', network: 'ethereum' }, { headers })).data
    const cart = (await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { ...headers, 'If-Match': '0', 'X-Mutation-Id': 'recover-add' } })).data
    const quote = (await api.post('/quotes', { walletId: saved.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.revision }, { headers })).data
    const collector = { displayName: 'A', username: 'a', network: 'ethereum' as const, profileName: 'A', address: wallet.address, walletType: 'metamask' as const, referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const attempts = new OrderAttemptManager(api, sessions, storage)
    api.defaults.timeout = 150
    await assert.rejects(attempts.create({ quoteId: quote.id, quoteFingerprint: quote.fingerprint, cartRevision: cart.revision, walletId: saved.id, provider: 'metamask', network: 'ethereum', connectionId: connection.id, collector }), (error: unknown) => axios.isAxiosError(error) && error.code === 'ECONNABORTED')
    const originalAttempt = storage.getItem('kurio.order-attempt')
    assert.ok(originalAttempt)
    await api.post('/__mock/clock', { advanceMs: 30 * 60_000 })
    await assert.rejects(attempts.recover(), (error: unknown) => axios.isAxiosError(error) && error.response?.status === 401)
    await sessions.clear()
    api.defaults.timeout = 0
    await sessions.login('colecionador.a@kurio.test', 'DemoA!2026')
    assert.equal(storage.getItem('kurio.order-attempt'), originalAttempt)
    const recovered = await attempts.recover()
    const retry = await attempts.retry()
    assert.equal(recovered.status, 'confirmed')
    assert.equal(retry.id, recovered.id)
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('orders')
      const request = tx.objectStore('orders').count()
      tx.oncomplete = () => resolve(request.result)
      tx.onabort = () => reject(tx.error)
    })
    assert.equal(count, 1)
  } finally { server.close(); db.close() }
})

test('a delayed recovery cannot return an order after its attempt was cleared', async () => {
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config })
  })
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } as Storage
  const payload = { quoteId: 'quote', quoteFingerprint: 'fingerprint', cartRevision: 1, walletId: 'wallet', provider: 'metamask', network: 'ethereum', connectionId: 'connection', collector: { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' } }
  storage.setItem(ORDER_ATTEMPT_KEY, JSON.stringify({ ownerUserId: 'a', key: crypto.randomUUID(), payload }))
  const sessions = { session: { token: 'token', userId: 'a' }, sessionGeneration: 1 } as unknown as SessionManager
  const attempts = new OrderAttemptManager(axios.create({ adapter }), sessions, storage)
  const recovery = attempts.recover()
  await new Promise((resolve) => setImmediate(resolve))
  attempts.clear()
  release()
  await assert.rejects(recovery, /Order attempt changed/)
})
