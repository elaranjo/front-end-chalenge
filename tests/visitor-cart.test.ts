import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { openMockDatabase } from '../src/mocks/database.ts'
import { mergeVisitorCart, visitorId } from '../src/shared/visitor-cart.ts'

test('failed merge preserves visitor identity and success rotates it once', async () => {
  const db = await openMockDatabase('test-visitor-client')
  await initializeCatalog(db)
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...cartHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } } as Storage
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  try {
    const id = visitorId(storage)
    await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { 'X-Visitor-Id': id, 'If-Match': '0', 'X-Mutation-Id': 'item-1' } })
    await assert.rejects(mergeVisitorCart(api, storage, 'invalid'))
    assert.equal(visitorId(storage), id)
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const merged = await mergeVisitorCart(api, storage, login.data.token)
    assert.equal(merged.cart.lines[0].quantity, 2)
    assert.notEqual(visitorId(storage), id)
  } finally { server.close(); db.close() }
})
