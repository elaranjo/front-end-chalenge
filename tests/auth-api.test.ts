import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { openMockDatabase } from '../src/mocks/database.ts'

test('simulated sessions support login, refresh, expiry, logout and account conflict', async () => {
  const database = await openMockDatabase('test-auth-api')
  await initializeAccounts(database)
  let now = Date.parse('2026-07-29T12:00:00Z')
  const server = setupServer(...authHandlers(database, () => now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    assert.equal((await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'wrong' })).status, 401)
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    assert.equal(login.status, 200)
    assert.equal(JSON.stringify(login.data).includes('password'), false)
    const headers = { Authorization: `Bearer ${login.data.token}` }
    assert.equal((await api.get('/auth/session', { headers })).data.userId, 'collector-a')
    now += 30 * 60_000
    assert.equal((await api.get('/auth/session', { headers })).status, 401)
    const newLogin = await api.post('/auth/login', { email: 'colecionador.b@kurio.test', password: 'DemoB!2026' })
    const newHeaders = { Authorization: `Bearer ${newLogin.data.token}` }
    assert.equal((await api.post('/auth/logout', {}, { headers: newHeaders })).status, 204)
    assert.equal((await api.get('/auth/session', { headers: newHeaders })).status, 401)
    const credentials = { username: 'example', email: 'example@kurio.test', password: 'demo', passwordConfirmation: 'demo' }
    const responses = await Promise.all([api.post('/auth/signup', credentials), api.post('/auth/signup', credentials)])
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409])
    const conflict = responses.find((response) => response.status === 409)!
    assert.deepEqual(conflict.data.error.fieldErrors, { email: 'E-mail já cadastrado', username: 'Nome de usuário já cadastrado' })
    const emailOnly = await api.post('/auth/signup', { ...credentials, username: 'outro' })
    assert.deepEqual(emailOnly.data.error.fieldErrors, { email: 'E-mail já cadastrado' })
    const usernameOnly = await api.post('/auth/signup', { ...credentials, email: 'outro@kurio.test' })
    assert.deepEqual(usernameOnly.data.error.fieldErrors, { username: 'Nome de usuário já cadastrado' })
    assert.equal((await api.post('/auth/signup', { ...credentials, passwordConfirmation: 'different' })).status, 422)
  } finally {
    server.close()
    database.close()
  }
})
