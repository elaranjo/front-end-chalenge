import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { type AxiosAdapter } from 'axios'
import { setupServer } from 'msw/node'
import { QueryClient } from '@tanstack/react-query'
import { openMockDatabase } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { profileHandlers } from '../src/mocks/profile-handlers.ts'
import { ProfileClient } from '../src/shared/profile-client.ts'
import { EventGate } from '../src/realtime/event-gate.ts'
import type { SessionManager } from '../src/shared/session.ts'

test('profile client sends avatar and fields atomically and updates only the owning cache', async () => {
  const db = await openMockDatabase('profile-client')
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...profileHandlers(db, Date.now, async (file) => file.size > 8))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  try {
    const login = (await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })).data
    const sessions = { session: login, sessionGeneration: 1 } as unknown as SessionManager
    const cache = new QueryClient()
    const gate = new EventGate(login.userId, login.sessionId)
    const client = new ProfileClient(api, cache, sessions, () => gate)
    cache.setQueryData(['profile', login.userId, 1], login.profile)
    const fields = { displayName: 'Novo nome', username: login.profile.username, email: login.profile.email, ensName: '', walletNickname: '', passwordChange: { current: 'errada', new: 'nova', confirmation: 'nova' } }
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a+8AAAAASUVORK5CYII=', 'base64')
    const avatar = new Blob([bytes], { type: 'image/png' })
    await assert.rejects(client.save(fields, 1, avatar), (error: unknown) => axios.isAxiosError(error) && error.response?.status === 422)
    assert.deepEqual(cache.getQueryData(['profile', login.userId, 1]), login.profile)
    assert.equal(cache.getQueryState(['profile', login.userId, 1])?.isInvalidated, true)
    const saved = await client.save({ ...fields, passwordChange: { ...fields.passwordChange, current: 'DemoA!2026' } }, 1, avatar)
    assert.equal(saved.displayName, 'Novo nome')
    assert.equal(saved.avatarUrl, '/api/v1/profile/avatar')
    assert.deepEqual(cache.getQueryData(['profile', login.userId, 1]), saved)
    assert.equal(JSON.stringify(cache.getQueryData(['profile', login.userId, 1])).includes('nova'), false)
    assert.equal(gate.observePrivate('profile', login.userId, 1), false)
  } finally { server.close(); db.close() }
})

test('avatar responses from a previous session cannot be displayed', async () => {
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: new Blob(['image'], { type: 'image/png' }), status: 200, statusText: 'OK', headers: {}, config })
  })
  const state = { session: { token: 'a', userId: 'a' }, sessionGeneration: 1 }
  const client = new ProfileClient(axios.create({ adapter }), new QueryClient(), state as unknown as SessionManager, () => null)
  const pending = client.avatar()
  await new Promise((resolve) => setImmediate(resolve))
  state.session = { token: 'b', userId: 'b' }
  state.sessionGeneration++
  release()
  await assert.rejects(pending, /Session changed/)
})
