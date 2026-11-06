import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { AxiosError, type AxiosAdapter } from 'axios'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { FavoritesClient } from '../src/shared/favorites-client.ts'
import { createCatalogSeed } from '../src/mocks/catalog-seed.ts'
import type { SessionManager } from '../src/shared/session.ts'
import { EventGate } from '../src/realtime/event-gate.ts'

test('optimistic favorites preserve later intent and ignore a response after session change', async () => {
  const nft = createCatalogSeed()[0]
  let rejectFirst!: (error: Error) => void
  let resolveLast!: (value: { data: unknown; status: number; statusText: string; headers: object; config: never }) => void
  let calls = 0
  const methods: string[] = []
  const adapter: AxiosAdapter = (config) => {
    calls++
    methods.push(config.method!)
    if (calls === 1) return new Promise((_resolve, reject) => { rejectFirst = reject })
    if (config.method === 'get') return Promise.resolve({ data: { items: [], version: 0 }, status: 200, statusText: 'OK', headers: {}, config })
    return new Promise((resolve) => { resolveLast = resolve as typeof resolveLast })
  }
  const sessionState = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const queries = new QueryClient()
  const gate = new EventGate('a', 'session')
  const client = new FavoritesClient(axios.create({ adapter }), queries, sessionState as unknown as SessionManager, () => gate)
  const first = client.set(nft, true)
  const second = client.set(nft, false)
  assert.equal(queries.getQueryData<{ items: unknown[] }>(['favorites', 'a', 1])?.items.length, 0)
  await new Promise((resolve) => setImmediate(resolve))
  rejectFirst(new AxiosError('failure'))
  await assert.rejects(first)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(methods, ['put', 'get', 'delete'])
  sessionState.session = { token: 'b', userId: 'b' }
  sessionState.sessionGeneration = 2
  queries.removeQueries({ queryKey: ['favorites'] })
  resolveLast({ data: { nftId: nft.id, favorite: false, version: 1 }, status: 200, statusText: 'OK', headers: {}, config: {} as never })
  await assert.rejects(second, /Session changed/)
  assert.equal(queries.getQueryData(['favorites', 'a', 1]), undefined)
  assert.equal(queries.getQueryData(['favorites', 'b', 2]), undefined)
})

test('favorites list ignores an older response arriving after a newer version', async () => {
  let release!: () => void
  let calls = 0
  const adapter: AxiosAdapter = (config) => {
    calls++
    if (calls === 1) return new Promise((resolve) => { release = () => resolve({ data: { items: [], version: 1 }, status: 200, statusText: 'OK', headers: {}, config }) })
    return Promise.resolve({ data: { items: [], version: 2 }, status: 200, statusText: 'OK', headers: {}, config })
  }
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const gate = new EventGate('a', 'session')
  const client = new FavoritesClient(axios.create({ adapter }), new QueryClient(), state as unknown as SessionManager, () => gate)
  const older = client.load()
  assert.equal((await client.load()).version, 2)
  release()
  await assert.rejects(older, /Stale favorites response/)
})

test('an unresolved network failure blocks later writes until the server can be queried', async () => {
  const nft = createCatalogSeed()[0]
  const methods: string[] = []
  let online = false
  const adapter: AxiosAdapter = async (config) => {
    methods.push(config.method!)
    if (!online) throw new AxiosError('network unavailable')
    return { data: config.method === 'get' ? { items: [], version: 0 } : { nftId: nft.id, favorite: true, version: 1 }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const gate = new EventGate('a', 'session')
  const client = new FavoritesClient(axios.create({ adapter }), new QueryClient(), state as unknown as SessionManager, () => gate)
  await assert.rejects(client.set(nft, true))
  await assert.rejects(client.set(nft, true))
  assert.equal(methods.filter((method) => method === 'put').length, 1)
  online = true
  await client.set(nft, true)
  assert.deepEqual(methods.slice(-2), ['get', 'put'])
})

test('a favorite list containing an NFT older than a received event is rejected', async () => {
  const nft = createCatalogSeed()[0]
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: { items: [nft], version: 1 }, status: 200, statusText: 'OK', headers: {}, config })
  })
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const gate = new EventGate('a', 'session')
  const client = new FavoritesClient(axios.create({ adapter }), new QueryClient(), state as unknown as SessionManager, () => gate)
  const pending = client.load()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(gate.observeNft(nft.id, nft.version + 1, 2), true)
  release()
  await assert.rejects(pending, /Stale favorites response/)
})

test('favorite query is private and cannot fetch under a different session generation', async () => {
  let calls = 0
  const adapter: AxiosAdapter = async (config) => {
    calls++
    return { data: { items: [], version: 0 }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const gate = new EventGate('a', 'session')
  const client = new FavoritesClient(axios.create({ adapter }), queries, state as unknown as SessionManager, () => gate)
  const options = client.listQuery()
  assert.deepEqual(options.queryKey, ['favorites', 'a', 1])
  assert.deepEqual(options.meta, { private: true, ownerId: 'a' })
  await queries.fetchQuery(options)
  state.session = { token: 'b', userId: 'b' }
  state.sessionGeneration = 2
  await assert.rejects(queries.fetchQuery({ ...options, staleTime: 0 }), /Session changed/)
  assert.equal(calls, 1)
  assert.equal(queries.getQueryData(['favorites', 'b', 2]), undefined)
})

test('a late favorite response preserves newer NFT data already in the cache', async () => {
  const nft = createCatalogSeed()[0]
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: { nftId: nft.id, favorite: true, version: 1 }, status: 200, statusText: 'OK', headers: {}, config })
  })
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const queries = new QueryClient()
  const gate = new EventGate('a', 'session')
  const client = new FavoritesClient(axios.create({ adapter }), queries, state as unknown as SessionManager, () => gate)
  const pending = client.set(nft, true)
  await new Promise((resolve) => setImmediate(resolve))
  const updated = { ...nft, version: nft.version + 1, name: 'Atualizado' }
  queries.setQueryData(['favorites', 'a', 1], { items: [updated], version: 1 })
  release()
  await pending
  assert.equal(queries.getQueryData<{ items: typeof nft[] }>(['favorites', 'a', 1])?.items[0].name, 'Atualizado')
})

test('the active favorite list refetches after the last queued mutation', async () => {
  const nft = createCatalogSeed()[0]
  let writes = 0
  let reads = 0
  let releaseFirst!: () => void
  let releaseSecond!: () => void
  const adapter: AxiosAdapter = (config) => {
    if (config.method === 'get') {
      reads++
      return Promise.resolve({ data: { items: [], version: writes }, status: 200, statusText: 'OK', headers: {}, config })
    }
    return new Promise((resolve) => {
      const complete = () => { writes++; resolve({ data: { nftId: nft.id, favorite: config.method === 'put', version: writes }, status: 200, statusText: 'OK', headers: {}, config }) }
      if (config.method === 'put') releaseFirst = complete
      else releaseSecond = complete
    })
  }
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const gate = new EventGate('a', 'session')
  const client = new FavoritesClient(axios.create({ adapter }), queries, state as unknown as SessionManager, () => gate)
  const observer = new QueryObserver(queries, client.listQuery())
  const unsubscribe = observer.subscribe(() => {})
  try {
    await new Promise((resolve) => setImmediate(resolve))
    const first = client.set(nft, true)
    const second = client.set(nft, false)
    await new Promise((resolve) => setImmediate(resolve))
    releaseFirst()
    await first
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(reads, 1)
    releaseSecond()
    await second
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(reads, 2)
    assert.equal(observer.getCurrentResult().data?.items.length, 0)
  } finally { unsubscribe() }
})
