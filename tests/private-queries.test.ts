import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { type AxiosAdapter } from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { privateQueries } from '../src/shared/private-queries.ts'
import type { SessionManager } from '../src/shared/session.ts'
import { EventGate } from '../src/realtime/event-gate.ts'

test('private query rejects an old response after another account takes over', async () => {
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: { id: 'a', displayName: 'A', username: 'a', email: 'a@kurio.test', ensName: '', walletNickname: '', avatarUrl: null, version: 1 }, status: 200, statusText: 'OK', headers: {}, config })
  })
  const state = { session: { token: 'token-a', userId: 'a' }, sessionGeneration: 1 }
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let gate = new EventGate('a', 'session-a')
  const options = privateQueries(axios.create({ adapter }), state as unknown as SessionManager, () => gate).profile()
  const result = queries.fetchQuery(options)
  await new Promise((resolve) => setImmediate(resolve))
  state.session = { token: 'token-b', userId: 'b' }
  state.sessionGeneration = 2
  gate = new EventGate('b', 'session-b')
  release()
  await assert.rejects(result, /Session changed/)
  assert.equal(queries.getQueryData(options.queryKey), undefined)
  assert.equal(options.meta?.private, true)
  assert.equal(options.meta?.ownerId, 'a')
  const otherOptions = privateQueries(axios.create({ adapter }), state as unknown as SessionManager, () => gate).profile()
  const wrongOwner = queries.fetchQuery(otherOptions)
  await new Promise((resolve) => setImmediate(resolve))
  release()
  await assert.rejects(wrongOwner, /Response owner mismatch/)
  assert.equal(queries.getQueryData(otherOptions.queryKey), undefined)
})

test('profile and wallet versions cannot regress within the same session', async () => {
  let version = 2
  const adapter: AxiosAdapter = async (config) => ({
    data: config.url === '/profile'
      ? { id: 'a', displayName: 'A', username: 'a', email: 'a@kurio.test', ensName: '', walletNickname: '', avatarUrl: null, version }
      : { items: [], version },
    status: 200, statusText: 'OK', headers: {}, config,
  })
  const sessions = { session: { token: 'token-a', userId: 'a' }, sessionGeneration: 1 } as unknown as SessionManager
  const gate = new EventGate('a', 'session-a')
  const queries = privateQueries(axios.create({ adapter }), sessions, () => gate)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  assert.equal((await client.fetchQuery(queries.profile())).version, 2)
  assert.equal((await client.fetchQuery(queries.wallets())).version, 2)
  version = 1
  await assert.rejects(client.fetchQuery(queries.profile()), /stale/)
  await assert.rejects(client.fetchQuery(queries.wallets()), /stale/)
  assert.equal(client.getQueryData<{ version: number }>(queries.profile().queryKey)?.version, 2)
  assert.equal(client.getQueryData<{ version: number }>(queries.wallets().queryKey)?.version, 2)
})
