import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase, transact } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { favoriteHandlers } from '../src/mocks/favorite-handlers.ts'
import { profileHandlers } from '../src/mocks/profile-handlers.ts'
import { orderHandlers } from '../src/mocks/order-handlers.ts'

test('private lists do not disclose data if the session is revoked during the read', async () => {
  const db = await openMockDatabase('private-read-revocation')
  await initializeAccounts(db)
  await initializeCatalog(db)
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
  const server = setupServer(...authHandlers(db), ...walletHandlers(db, now), ...favoriteHandlers(db, now), ...profileHandlers(db, now), ...orderHandlers(db, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    for (const path of ['/wallets', '/favorites', '/profile/avatar', '/orders/nonexistent', '/orders/attempts/nonexistent']) {
      const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
      tokenToRevoke = login.data.token
      calls = 0
      const response = await api.get(path, { headers: { Authorization: `Bearer ${login.data.token}` } })
      assert.equal(response.status, 401, path)
      assert.equal(response.data.error.code, 'SESSION_INVALID')
      assert.equal(response.data.items, undefined)
    }
  } finally { server.close(); db.close() }
})
