import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { type AxiosAdapter } from 'axios'
import { setupServer } from 'msw/node'
import { QueryClient } from '@tanstack/react-query'
import { openMockDatabase } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { WalletClient } from '../src/shared/wallet-client.ts'
import type { SessionManager } from '../src/shared/session.ts'

test('wallet client saves, connects and disconnects through the private API', async () => {
  const db = await openMockDatabase('wallet-client')
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...walletHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  try {
    const login = (await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })).data
    const sessions = { session: login, sessionGeneration: 1 } as unknown as SessionManager
    const cache = new QueryClient()
    const client = new WalletClient(api, cache, sessions)
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum' as const, profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask' as const, referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const key = ['wallets', login.userId, 1]
    cache.setQueryData(key, { items: [], version: 0 })
    const saved = await client.save('primary', wallet, 0)
    assert.equal(saved.version, 1)
    assert.equal(cache.getQueryState(key)?.isInvalidated, true)
    cache.setQueryData(key, { items: [saved], version: 1 })
    await assert.rejects(client.save('primary', wallet, 0), (error: unknown) => axios.isAxiosError(error) && error.response?.status === 409)
    assert.equal(cache.getQueryState(key)?.isInvalidated, true)
    const connection = await client.connect({ walletId: saved.id, provider: 'metamask', network: 'ethereum' })
    assert.equal(connection.status, 'connected')
    await client.disconnect(connection.id)
    const replacement = await client.connect({ walletId: saved.id, provider: 'metamask', network: 'ethereum' })
    assert.notEqual(replacement.id, connection.id)
  } finally { server.close(); db.close() }
})

test('a late connection response is discarded after account change', async () => {
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: { id: 'connection-a', status: 'connected', walletId: 'wallet-a', provider: 'metamask', network: 'ethereum', version: 1 }, status: 200, statusText: 'OK', headers: {}, config })
  })
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const client = new WalletClient(axios.create({ adapter }), new QueryClient(), state as unknown as SessionManager)
  const request = client.connect({ walletId: 'wallet-a', provider: 'metamask', network: 'ethereum' })
  await new Promise((resolve) => setImmediate(resolve))
  state.session = { token: 'b', userId: 'b' }; state.sessionGeneration = 2
  release()
  await assert.rejects(request, /Session changed/)
})
