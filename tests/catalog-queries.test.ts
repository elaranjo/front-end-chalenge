import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { type AxiosAdapter } from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { catalogQueries } from '../src/shared/catalog-queries.ts'
import { StaleCatalogResponse } from '../src/shared/catalog-client.ts'
import { createCatalogSeed } from '../src/mocks/catalog-seed.ts'
import { EventGate } from '../src/realtime/event-gate.ts'

test('detail response from an old connection or catalog version cannot enter the cache', async () => {
  let release!: () => void
  const nft = createCatalogSeed()[0]
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: nft, status: 200, statusText: 'OK', headers: { 'x-catalog-version': '1' }, config })
  })
  let gate = new EventGate(null, 'visitor')
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const catalog = catalogQueries(axios.create({ adapter }), () => gate)
  const options = catalog.detail(nft.id)
  const request = queries.fetchQuery(options)
  await new Promise((resolve) => setImmediate(resolve))
  gate.observeCatalog(2)
  release()
  await assert.rejects(request, StaleCatalogResponse)
  assert.equal(queries.getQueryData(options.queryKey), undefined)
  gate = new EventGate(null, 'visitor-new')
  const requestAfterReconnect = queries.fetchQuery(options)
  await new Promise((resolve) => setImmediate(resolve))
  gate = new EventGate(null, 'visitor-newer')
  release()
  await assert.rejects(requestAfterReconnect, StaleCatalogResponse)
  assert.equal(queries.getQueryData(options.queryKey), undefined)
})

test('catalog keys normalize filter ordering without merging distinct searches', () => {
  const catalog = catalogQueries(axios.create(), () => null)
  const first = catalog.list({ q: 'ape', category: ['Música', 'Arte digital'] }).queryKey
  const same = catalog.list({ q: 'ape', category: ['Arte digital', 'Música', 'Música'] }).queryKey
  const different = catalog.list({ q: 'other', category: ['Arte digital', 'Música'] }).queryKey
  assert.deepEqual(first, same)
  assert.notDeepEqual(first, different)
})

test('cancelling a catalog query aborts its network request and leaves no cached result', async () => {
  let started!: () => void
  const ready = new Promise<void>((resolve) => { started = resolve })
  let aborted = false
  const adapter: AxiosAdapter = (config) => new Promise((_resolve, reject) => {
    config.signal?.addEventListener('abort', () => { aborted = true; reject(new axios.CanceledError()) })
    started()
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const gate = new EventGate(null, 'visitor')
  const options = catalogQueries(axios.create({ adapter }), () => gate).list({ q: 'ape' })
  const request = client.fetchQuery(options)
  await ready
  await client.cancelQueries({ queryKey: options.queryKey, exact: true })
  await assert.rejects(request)
  assert.equal(aborted, true)
  assert.equal(client.getQueryData(options.queryKey), undefined)
})
