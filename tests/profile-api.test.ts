import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { profileHandlers } from '../src/mocks/profile-handlers.ts'

test('profile, avatar and password commit atomically and enforce revision and ownership', async () => {
  const database = await openMockDatabase('test-profile-api')
  await initializeAccounts(database)
  const server = setupServer(...authHandlers(database), ...profileHandlers(database, Date.now, async (file) => file.size > 8))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const loginB = await api.post('/auth/login', { email: 'colecionador.b@kurio.test', password: 'DemoB!2026' })
    const headers = { Authorization: `Bearer ${login.data.token}`, 'If-Match': '1' }
    const fields = { displayName: 'Novo nome', username: login.data.profile.username, email: login.data.profile.email, ensName: '', walletNickname: '' }
    const makeForm = (data: unknown, bytes?: number[], type = 'image/png') => {
      const form = new FormData()
      form.set('fields', JSON.stringify(data))
      if (bytes) form.set('avatar', new Blob([new Uint8Array(bytes)], { type }), 'avatar.png')
      return form
    }
    const png = Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a+8AAAAASUVORK5CYII=', 'base64'))
    const wrong = { ...fields, passwordChange: { current: 'errada', new: 'nova', confirmation: 'nova' } }
    assert.equal((await api.put('/profile', makeForm(wrong, png), { headers })).status, 422)
    assert.equal((await api.get('/profile', { headers })).data.displayName, login.data.profile.displayName)
    assert.equal((await api.get('/profile/avatar', { headers })).status, 404)
    assert.equal((await api.put('/profile', makeForm(fields, [1, 2, 3]), { headers })).status, 422)
    assert.equal((await api.put('/profile', makeForm(fields, png.slice(0, 8)), { headers })).status, 422)
    const valid = { ...fields, passwordChange: { current: 'DemoA!2026', new: 'nova', confirmation: 'nova' } }
    const saved = await api.put('/profile', makeForm(valid, png), { headers })
    assert.equal(saved.status, 200)
    assert.equal(saved.data.version, 2)
    assert.equal(saved.data.passwordHash, undefined)
    const reopened = await openMockDatabase('test-profile-api')
    try {
      const persisted = await new Promise<{ profile: any; avatar: any; user: any }>((resolve, reject) => {
        const tx = reopened.transaction(['profiles', 'avatars', 'users'])
        const profile = tx.objectStore('profiles').get(login.data.userId)
        const avatar = tx.objectStore('avatars').get(login.data.userId)
        const user = tx.objectStore('users').get(login.data.userId)
        tx.oncomplete = () => resolve({ profile: profile.result, avatar: avatar.result, user: user.result })
        tx.onabort = () => reject(tx.error)
      })
      assert.equal(persisted.profile.displayName, 'Novo nome')
      assert.equal(persisted.avatar.blob.size, png.length)
      assert.ok(persisted.user.passwordHash.hash)
      assert.equal(JSON.stringify(persisted.user).includes('nova'), false)
    } finally { reopened.close() }
    assert.equal((await api.get('/profile/avatar', { headers, responseType: 'arraybuffer' })).status, 200)
    assert.equal((await api.get('/profile/avatar', { headers: { Authorization: `Bearer ${loginB.data.token}` } })).status, 404)
    assert.equal((await api.put('/profile', makeForm(fields), { headers })).status, 409)
    assert.equal((await api.post('/auth/login', { email: fields.email, password: 'DemoA!2026' })).status, 401)
    assert.equal((await api.post('/auth/login', { email: fields.email, password: 'nova' })).status, 200)
    assert.equal((await api.put('/profile', makeForm({ ...fields, avatar: null }), { headers: { ...headers, 'If-Match': '2' } })).status, 200)
    assert.equal((await api.get('/profile/avatar', { headers })).status, 404)
  } finally { server.close(); database.close() }
})
