import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { type AxiosAdapter } from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { cartQueries, StaleCartResponse } from '../src/shared/cart-queries.ts'
import { EventGate } from '../src/realtime/event-gate.ts'
import type { SessionManager } from '../src/shared/session.ts'

test('cart queries reject old revisions and replies from a previous owner', async () => {
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: { id: 'user:a', ownerKind: 'user', revision: 1, catalogVersion: 1, lines: [], couponCode: null, quote: null, adjustments: [] }, status: 200, statusText: 'OK', headers: {}, config })
  })
  const state = { session: { token: 'token-a', userId: 'a' }, sessionGeneration: 1 }
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } as Storage
  const gate = new EventGate('a', 'session-a')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const options = cartQueries(axios.create({ adapter }), state as unknown as SessionManager, storage, () => gate).current()
  assert.equal(options.meta?.private, true)
  assert.equal(options.meta?.ownerId, 'a')
  const stale = client.fetchQuery(options)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(gate.observeCart('user:a', 2, 1), true)
  release()
  await assert.rejects(stale, StaleCartResponse)
  assert.equal(client.getQueryData(options.queryKey), undefined)
  const oldOwner = client.fetchQuery(options)
  await new Promise((resolve) => setImmediate(resolve))
  state.session = { token: 'token-b', userId: 'b' }
  state.sessionGeneration++
  release()
  await assert.rejects(oldOwner, StaleCartResponse)
  assert.equal(client.getQueryData(options.queryKey), undefined)
})
