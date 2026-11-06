import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase, transact } from '../src/mocks/database.ts'
import { catalogHandlers, initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { fetchNft } from '../src/shared/catalog-client.ts'
import { EventGate } from '../src/realtime/event-gate.ts'

test('Axios reaches catalog handlers backed by persisted IndexedDB state', async () => {
  const database = await openMockDatabase('test-catalog-api')
  await initializeCatalog(database)
  const server = setupServer(...catalogHandlers(database))
  server.listen({ onUnhandledRequest: 'error' })
  try {
    const api = axios.create({ baseURL: 'http://localhost/api/v1' })
    const list = await api.get('/nfts', { params: { q: 'Emerald', page: 1 } })
    assert.equal(list.status, 200)
    assert.equal(list.data.items[0].id, 'emerald-ape-042')
    assert.equal(list.data.catalogVersion, 1)
    const detail = await api.get('/nfts/emerald-ape-042')
    assert.equal(detail.data.tokenId, '#0042')
    const gate = new EventGate(null, 'visitor')
    assert.equal((await fetchNft(api, 'emerald-ape-042', gate)).tokenId, '#0042')
    assert.equal(gate.catalogVersion, 1)
    await assert.rejects(api.get('/nfts/missing'), (error: unknown) => axios.isAxiosError(error) && error.response?.status === 404)
    await assert.rejects(api.get('/nfts?page=0'), (error: unknown) => axios.isAxiosError(error) && error.response?.status === 400)
    await transact(database, ['catalog'], 'readwrite', (tx) => tx.objectStore('catalog').delete('emerald-ape-042'))
    await initializeCatalog(database)
    await assert.rejects(api.get('/nfts/emerald-ape-042'), (error: unknown) => axios.isAxiosError(error) && error.response?.status === 404)
  } finally {
    server.close()
    database.close()
  }
})
