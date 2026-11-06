import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { openMockDatabase } from '../src/mocks/database.ts'
import { SessionManager } from '../src/shared/session.ts'
import { ORDER_ATTEMPT_KEY } from '../src/shared/order-attempt.ts'
import { visitorId, VISITOR_KEY } from '../src/shared/visitor-cart.ts'
import { CHECKOUT_DRAFT_KEY, CheckoutDraftStore } from '../src/shared/checkout-draft.ts'

test('session recovery and account change clear only private cache', async () => {
  const db = await openMockDatabase('test-session-client')
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  } as Storage
  const client = axios.create({ baseURL: 'http://localhost/api/v1' })
  const queries = new QueryClient()
  const manager = new SessionManager(client, queries, storage)
  try {
    const originalVisitor = visitorId(storage)
    await manager.login('colecionador.a@kurio.test', 'DemoA!2026')
    assert.equal(manager.session?.userId, 'collector-a')
    const drafts = new CheckoutDraftStore(manager, storage)
    drafts.save({ collector: { displayName: 'A', email: 'parcial@' }, useOtherWallet: false })
    assert.throws(() => drafts.save({ collector: { password: 'secret' }, useOtherWallet: false } as never))
    const attempt = JSON.stringify({ ownerUserId: 'collector-a', key: 'pending' })
    storage.setItem(ORDER_ATTEMPT_KEY, attempt)
    let clearedSynchronously = false
    const unsubscribe = manager.subscribe((session) => { if (!session) clearedSynchronously = true })
    const clearing = manager.clear()
    assert.equal(clearedSynchronously, true)
    await clearing
    unsubscribe()
    assert.equal(storage.getItem(ORDER_ATTEMPT_KEY), attempt)
    assert.equal(storage.getItem(VISITOR_KEY), originalVisitor)
    await manager.login('colecionador.a@kurio.test', 'DemoA!2026')
    assert.equal(storage.getItem(ORDER_ATTEMPT_KEY), attempt)
    assert.equal(drafts.load()?.collector.email, 'parcial@')
    queries.setQueryData(['private'], 'user-a')
    queries.getQueryCache().find({ queryKey: ['private'] })!.setOptions({ queryKey: ['private'], meta: { private: true } })
    queries.setQueryData(['catalog'], 'public')
    await manager.login('colecionador.b@kurio.test', 'DemoB!2026')
    assert.equal(storage.getItem(ORDER_ATTEMPT_KEY), null)
    assert.equal(storage.getItem(CHECKOUT_DRAFT_KEY), null)
    const afterSwitch = storage.getItem(VISITOR_KEY)
    assert.notEqual(afterSwitch, originalVisitor)
    assert.equal(manager.session?.userId, 'collector-b')
    assert.equal(queries.getQueryData(['private']), undefined)
    assert.equal(queries.getQueryData(['catalog']), 'public')
    const restored = new SessionManager(client, new QueryClient(), storage)
    assert.equal((await restored.restore())?.userId, 'collector-b')
    new CheckoutDraftStore(restored, storage).save({ collector: {}, useOtherWallet: false })
    storage.setItem(ORDER_ATTEMPT_KEY, JSON.stringify({ ownerUserId: 'collector-b' }))
    await restored.logout()
    assert.equal(restored.session, null)
    assert.equal(storage.getItem(ORDER_ATTEMPT_KEY), null)
    assert.equal(storage.getItem(CHECKOUT_DRAFT_KEY), null)
    assert.equal(storage.getItem('kurio.session-token'), null)
    assert.notEqual(storage.getItem(VISITOR_KEY), afterSwitch)
  } finally {
    server.close()
    db.close()
  }
})

test('an older session cleanup does not remove a new private query created while cancellation waits', async () => {
  const queries = new QueryClient()
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage
  const manager = new SessionManager(axios.create(), queries, storage)
  const previousKey = ['profile', 'a', 1]
  queries.setQueryData(previousKey, 'A')
  queries.getQueryCache().find({ queryKey: previousKey })!.setOptions({ queryKey: previousKey, meta: { private: true, ownerId: 'a' } })
  const cancel = queries.cancelQueries.bind(queries)
  let release!: () => void
  const waiting = new Promise<void>((resolve) => { release = resolve })
  queries.cancelQueries = async (...args) => { await waiting; return cancel(...args) }
  const cleanup = manager.clear()
  const nextKey = ['profile', 'b', 2]
  queries.setQueryData(nextKey, 'B')
  queries.getQueryCache().find({ queryKey: nextKey })!.setOptions({ queryKey: nextKey, meta: { private: true, ownerId: 'b' } })
  release()
  await cleanup
  assert.equal(queries.getQueryData(previousKey), undefined)
  assert.equal(queries.getQueryData(nextKey), 'B')
})
