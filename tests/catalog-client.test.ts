import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { catalogSearchParams, fetchCatalog, StaleCatalogResponse } from '../src/shared/catalog-client.ts'
import { EventGate } from '../src/realtime/event-gate.ts'

test('catalog parameters are stable and retain repeated filter values', () => {
  assert.equal(catalogSearchParams({ q: ' ape ', category: ['Música', 'Arte digital', 'Música'], network: ['polygon', 'ethereum'], page: 2 }).toString(), 'q=ape&category=Arte+digital&category=M%C3%BAsica&network=ethereum&network=polygon&page=2')
})

test('a newer REST catalog response advances the watermark for later responses', async () => {
  const gate = new EventGate(null, 'visitor')
  let version = 5
  const server = setupServer(http.get('*/api/v1/nfts', () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 9, hasNext: false, catalogVersion: version, facets: { categories: {}, networks: {} } })))
  server.listen({ onUnhandledRequest: 'error' })
  try {
    const api = axios.create({ baseURL: 'http://localhost/api/v1' })
    await fetchCatalog(api, {}, gate)
    assert.equal(gate.catalogVersion, 5)
    version = 4
    await assert.rejects(fetchCatalog(api, {}, gate), StaleCatalogResponse)
  } finally { server.close() }
})

test('catalog responses older than a received event cannot be used', async () => {
  const gate = new EventGate(null, 'visitor')
  gate.observeNft('nft-1', 2, 3)
  const server = setupServer(http.get('*/api/v1/nfts', () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 9, hasNext: false, catalogVersion: 2, facets: { categories: {}, networks: {} } })))
  server.listen({ onUnhandledRequest: 'error' })
  try {
    const api = axios.create({ baseURL: 'http://localhost/api/v1' })
    await assert.rejects(fetchCatalog(api, {}, gate), StaleCatalogResponse)
  } finally { server.close() }
})
