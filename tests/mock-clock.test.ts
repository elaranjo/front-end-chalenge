import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { openMockDatabase, transact } from '../src/mocks/database.ts'
import { advanceMockClock, initialMockClock, initializeMockClock, readMockClock } from '../src/mocks/mock-clock.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { setupServer } from 'msw/node'
import axios from 'axios'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { profileHandlers } from '../src/mocks/profile-handlers.ts'
import { favoriteHandlers } from '../src/mocks/favorite-handlers.ts'
import { controlHandlers } from '../src/mocks/control-handlers.ts'

test('manual clock advances atomically and is shared between database connections', async () => {
  const first = await openMockDatabase('shared-clock')
  const second = await openMockDatabase('shared-clock')
  try {
    assert.deepEqual(await readMockClock(first, () => 123), { mode: 'real', now: 123 })
    await assert.rejects(advanceMockClock(first, 1), /Manual clock unavailable/)
    await transact(first, ['scenario'], 'readwrite', (tx) => { tx.objectStore('scenario').put(initialMockClock('manual')) })
    const initial = (await readMockClock(second)).now
    await Promise.all([advanceMockClock(first, 1000), advanceMockClock(second, 2000)])
    assert.equal((await readMockClock(first)).now, initial + 3000)
    await assert.rejects(advanceMockClock(first, -1), RangeError)
    assert.equal((await readMockClock(second)).now, initial + 3000)
  } finally { first.close(); second.close() }
})

test('real simulated clock starts from the reference date and advances with elapsed time', async () => {
  const db = await openMockDatabase('real-clock')
  try {
    await transact(db, ['scenario'], 'readwrite', (tx) => { tx.objectStore('scenario').put(initialMockClock('real', () => 10_000)) })
    assert.deepEqual(await readMockClock(db, () => 12_500), { mode: 'real', now: Date.parse('2026-07-29T12:00:02.500Z') })
    await initializeMockClock(db)
    assert.equal((await readMockClock(db, () => 12_500)).now, Date.parse('2026-07-29T12:00:02.500Z'))
  } finally { db.close() }
})

test('authentication reads the persisted manual clock for expiry', async () => {
  const db = await openMockDatabase('auth-manual-clock')
  await initializeAccounts(db)
  const now = async () => (await readMockClock(db)).now
  const server = setupServer(...authHandlers(db, now), ...walletHandlers(db, now), ...profileHandlers(db, now), ...favoriteHandlers(db, now), ...controlHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    assert.equal((await api.post('/__mock/reset', { scenario: 'default', clockMode: 'manual' })).status, 200)
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const headers = { Authorization: `Bearer ${login.data.token}` }
    assert.equal((await api.get('/auth/session', { headers })).status, 200)
    for (const path of ['/wallets', '/profile', '/favorites']) assert.equal((await api.get(path, { headers })).status, 200)
    assert.equal((await api.post('/__mock/clock', { advanceMs: 30 * 60_000 })).status, 200)
    assert.equal((await api.get('/auth/session', { headers })).status, 401)
    for (const path of ['/wallets', '/profile', '/favorites']) assert.equal((await api.get(path, { headers })).status, 401)
  } finally { server.close(); db.close() }
})
