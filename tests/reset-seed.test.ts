import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { openMockDatabase, STORES, transact } from '../src/mocks/database.ts'
import { initializeAccounts, readSession } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { resetDefaultServerState, selectServerScenario, supportedScenarios } from '../src/mocks/reset-seed.ts'

test('server reset clears prior state and restores the initial seed atomically', async () => {
  const db = await openMockDatabase('reset-default-seed')
  await initializeCatalog(db)
  await initializeAccounts(db)
  try {
    await transact(db, ['sessions', 'carts', 'orders', 'outbox', 'scenario'], 'readwrite', (tx) => {
      tx.objectStore('sessions').put({ id: 'token', userId: 'collector-a', sessionId: 'session', expiresAt: '2099-01-01T00:00:00.000Z' })
      tx.objectStore('carts').put({ id: 'user:collector-a', lines: ['changed'] })
      tx.objectStore('orders').put({ id: 'order' })
      tx.objectStore('outbox').put({ id: 'old-event' })
      tx.objectStore('scenario').put({ id: 'network-fee', amount: '5', version: 1 })
    })
    const generation = await resetDefaultServerState(db)
    assert.equal(await readSession(db, 'token', Date.now()), undefined)
    const counts = await new Promise<Record<string, number>>((resolve, reject) => {
      const tx = db.transaction([...STORES], 'readonly')
      const requests = Object.fromEntries(STORES.map((name) => [name, tx.objectStore(name).count()]))
      tx.oncomplete = () => resolve(Object.fromEntries(Object.entries(requests).map(([name, request]) => [name, request.result])))
      tx.onabort = () => reject(tx.error)
    })
    assert.equal(counts.users, 2)
    assert.equal(counts.profiles, 2)
    assert.equal(counts.catalog, 36)
    for (const name of ['sessions', 'carts', 'orders', 'outbox', 'ledger', 'quotes', 'reservations']) assert.equal(counts[name], 0)
    const nextGeneration = await resetDefaultServerState(db)
    assert.notEqual(generation, nextGeneration)
  } finally { db.close() }
})

test('concurrent scenario selection resets once and preserves subsequent session state', async () => {
  const first = await openMockDatabase('scenario-selection-concurrent')
  const second = await openMockDatabase('scenario-selection-concurrent')
  try {
    await resetDefaultServerState(first)
    const results = await Promise.all([selectServerScenario(first, 'empty'), selectServerScenario(second, 'empty')])
    assert.equal(results.filter(Boolean).length, 1)
    await transact(first, ['sessions'], 'readwrite', (tx) => { tx.objectStore('sessions').put({ id: 'token', userId: 'collector-a', sessionId: 's', expiresAt: '2099-01-01T00:00:00.000Z' }) })
    assert.equal(await selectServerScenario(second, 'empty'), null)
    assert.ok(await readSession(first, 'token', Date.now()))
  } finally { first.close(); second.close() }
})

test('all documented scenarios reproduce the same seed after repeated resets', async () => {
  const expected = ['default', 'visual-desktop', 'visual-mobile', 'empty', 'slow', 'out-of-order', 'network-error', 'http-400', 'http-401', 'http-403', 'http-404', 'http-409', 'http-422', 'http-500', 'http-503', 'session-expired', 'signup-conflict', 'validation-errors', 'favorite-failure', 'coupon-invalid', 'coupon-expired', 'price-change', 'sold-out', 'fee-change', 'timeout-after-order-create', 'payment-confirmed', 'payment-declined', 'pending-disconnect', 'duplicate-old-events']
  assert.deepEqual([...supportedScenarios].sort(), expected.sort())
  const db = await openMockDatabase('repeat-scenario-seeds')
  const snapshot = () => new Promise<Record<string, unknown[]>>((resolve, reject) => {
    const tx = db.transaction([...STORES])
    const requests = Object.fromEntries(STORES.map((name) => [name, tx.objectStore(name).getAll()]))
    tx.oncomplete = () => resolve(Object.fromEntries(Object.entries(requests).map(([name, request]) => [name, name === 'scenario' ? request.result.filter((item) => item.id !== 'reset-generation') : request.result])))
    tx.onabort = () => reject(tx.error)
  })
  try {
    for (const scenario of supportedScenarios) {
      const firstGeneration = await resetDefaultServerState(db, 'manual', scenario, 42)
      const first = await snapshot()
      const secondGeneration = await resetDefaultServerState(db, 'manual', scenario, 42)
      assert.notEqual(firstGeneration, secondGeneration, scenario)
      const second = await snapshot()
      const normalize = (value: unknown, generation: string) => JSON.parse(JSON.stringify(value, (key, item) => {
        if (key === 'lineId') return '<line-id>'
        return typeof item === 'string' ? item.replaceAll(generation, '<generation>') : item
      }))
      assert.deepEqual(normalize(second, secondGeneration), normalize(first, firstGeneration), scenario)
    }
  } finally { db.close() }
})
