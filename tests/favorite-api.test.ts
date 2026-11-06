import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { favoriteHandlers } from '../src/mocks/favorite-handlers.ts'

test('favorites are private, persisted, and idempotent even for concurrent requests', async () => {
  const database = await openMockDatabase('test-favorites-api')
  await initializeCatalog(database)
  await initializeAccounts(database)
  const server = setupServer(...authHandlers(database), ...favoriteHandlers(database))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    assert.equal((await api.get('/favorites')).status, 401)
    const a = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const b = await api.post('/auth/login', { email: 'colecionador.b@kurio.test', password: 'DemoB!2026' })
    const headersA = { Authorization: `Bearer ${a.data.token}` }
    const headersB = { Authorization: `Bearer ${b.data.token}` }
    const url = '/favorites/emerald-ape-042'
    const added = await Promise.all([api.put(url, null, { headers: headersA }), api.put(url, null, { headers: headersA })])
    assert.deepEqual(added.map((response) => response.data.version), [1, 1])
    assert.equal((await api.get('/favorites', { headers: headersA })).data.items[0].id, 'emerald-ape-042')
    assert.equal((await api.get('/favorites', { headers: headersB })).data.items.length, 0)
    assert.equal((await api.put('/favorites/inexistente', null, { headers: headersA })).status, 404)
    const removed = await api.delete(url, { headers: headersA })
    assert.equal(removed.data.version, 2)
    assert.equal((await api.delete(url, { headers: headersA })).data.version, 2)
    const list = await api.get('/favorites', { headers: headersA })
    assert.equal(list.data.items.length, 0)
    assert.equal(list.data.version, 2)
  } finally { server.close(); database.close() }
})
