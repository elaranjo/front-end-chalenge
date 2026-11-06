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

test('malformed JSON is a transport error while valid invalid JSON is a validation error', async () => {
  const db = await openMockDatabase('malformed-requests')
  await initializeAccounts(db)
  await initializeCatalog(db)
  const server = setupServer(...authHandlers(db), ...cartHandlers(db), ...walletHandlers(db), ...orderHandlers(db), ...controlHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const auth = { Authorization: `Bearer ${login.data.token}` }
    const cases = [
      { method: 'post', path: '/auth/login', headers: {} },
      { method: 'post', path: '/cart/items', headers: { ...auth, 'If-Match': '0', 'X-Mutation-Id': 'malformed' } },
      { method: 'put', path: '/wallets/primary', headers: { ...auth, 'If-Match': '0' } },
      { method: 'post', path: '/orders', headers: { ...auth, 'Idempotency-Key': 'malformed' } },
      { method: 'post', path: '/__mock/actions', headers: {} },
    ]
    for (const entry of cases) {
      const send = (data: string) => api.request({ method: entry.method, url: entry.path, data, transformRequest: [(value) => value], headers: { ...entry.headers, 'Content-Type': 'application/json' } })
      const malformed = await send('{')
      assert.equal(malformed.status, 400, entry.path)
      assert.equal(malformed.data.error.code, 'MALFORMED_JSON')
      assert.equal((await send('null')).status, 422, entry.path)
    }
  } finally { server.close(); db.close() }
})
