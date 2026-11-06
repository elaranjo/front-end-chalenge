import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase, transact } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { walletConnectionSchema, walletListSchema } from '../src/shared/contracts.ts'

test('wallet mutations do not commit if their session is revoked after authentication', async () => {
  const database = await openMockDatabase('wallet-revocation-race')
  await initializeAccounts(database)
  let revokeToken: string | undefined
  let calls = 0
  const now = async () => {
    if (revokeToken && ++calls === 2) {
      const token = revokeToken
      revokeToken = undefined
      await transact(database, ['sessions'], 'readwrite', (tx) => { tx.objectStore('sessions').delete(token) })
    }
    return Date.now()
  }
  const server = setupServer(...authHandlers(database), ...walletHandlers(database, now))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
  const login = async () => (await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })).data.token as string
  const arm = (token: string) => { revokeToken = token; calls = 0 }
  try {
    let token = await login()
    const saved = await api.put('/wallets/primary', wallet, { headers: { Authorization: `Bearer ${token}`, 'If-Match': '0' } })
    const connection = await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers: { Authorization: `Bearer ${token}` } })
    arm(token)
    assert.equal((await api.put('/wallets/secondary', wallet, { headers: { Authorization: `Bearer ${token}`, 'If-Match': '0' } })).status, 401)
    token = await login()
    arm(token)
    assert.equal((await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers: { Authorization: `Bearer ${token}` } })).status, 401)
    token = await login()
    arm(token)
    assert.equal((await api.delete(`/wallet-connections/${connection.data.id}`, { headers: { Authorization: `Bearer ${token}` } })).status, 401)
    const records = await new Promise<{ wallets: any[]; connection: any }>((resolve, reject) => {
      const tx = database.transaction(['wallets', 'scenario'])
      const wallets = tx.objectStore('wallets').getAll()
      const current = tx.objectStore('scenario').get('connection:collector-a')
      tx.oncomplete = () => resolve({ wallets: wallets.result, connection: current.result })
      tx.onabort = () => reject(tx.error)
    })
    assert.equal(records.wallets.length, 1)
    assert.equal(records.connection.status, 'connected')
    assert.equal(records.connection.connectionId, connection.data.id)
  } finally { server.close(); database.close() }
})

test('wallet slots enforce session ownership, validation, and optimistic revision', async () => {
  const database = await openMockDatabase('test-wallet-api')
  await initializeAccounts(database)
  const server = setupServer(...authHandlers(database), ...walletHandlers(database))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    assert.equal((await api.get('/wallets')).status, 401)
    const loginA = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const loginB = await api.post('/auth/login', { email: 'colecionador.b@kurio.test', password: 'DemoB!2026' })
    const headers = { Authorization: `Bearer ${loginA.data.token}`, 'If-Match': '0' }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await api.put('/wallets/primary', wallet, { headers })
    assert.equal(saved.status, 200)
    assert.equal(saved.data.version, 1)
    assert.equal(saved.data.ownerUserId, undefined)
    assert.equal((await api.put('/wallets/primary', wallet, { headers })).status, 409)
    assert.equal((await api.put('/wallets/secondary', { ...wallet, address: 'invalid' }, { headers })).status, 422)
    const wallets = await api.get('/wallets', { headers })
    assert.equal(wallets.data.items.length, 1)
    assert.equal(walletListSchema.safeParse(wallets.data).success, true)
    assert.equal((await api.put('/wallets/secondary', wallet, { headers })).status, 200)
    assert.equal((await api.get('/wallets', { headers })).data.version, 2)
    const reopened = await openMockDatabase('test-wallet-api')
    try {
      const count = await new Promise<number>((resolve, reject) => {
        const tx = reopened.transaction('wallets')
        const request = tx.objectStore('wallets').count()
        tx.oncomplete = () => resolve(request.result)
        tx.onabort = () => reject(tx.error)
      })
      assert.equal(count, 2)
    } finally { reopened.close() }
    const connection = await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })
    assert.equal(connection.data.status, 'connected')
    assert.equal(walletConnectionSchema.safeParse(connection.data).success, true)
    assert.equal(walletConnectionSchema.safeParse({ ...connection.data, network: 'unknown' }).success, false)
    assert.equal((await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })).data.id, connection.data.id)
    assert.equal((await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'polygon' }, { headers })).status, 422)
    assert.equal((await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers: { Authorization: `Bearer ${loginB.data.token}` } })).status, 403)
    assert.equal((await api.post('/wallet-connections', { walletId: 'missing', provider: 'metamask', network: 'ethereum' }, { headers })).status, 404)
    assert.equal((await api.delete(`/wallet-connections/${connection.data.id}`, { headers })).status, 204)
    assert.equal((await api.delete(`/wallet-connections/${connection.data.id}`, { headers: { Authorization: `Bearer ${loginB.data.token}` } })).status, 403)
    await transact(database, ['scenario'], 'readwrite', (tx) => { tx.objectStore('scenario').put({ id: 'connection-behavior', refuse: true }) })
    assert.equal((await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })).data.status, 'refused')
    assert.equal((await api.get('/wallets', { headers: { Authorization: `Bearer ${loginB.data.token}` } })).data.items.length, 0)
  } finally { server.close(); database.close() }
})

test('wallet connections belong to a session and logout revokes only that session connection', async () => {
  const database = await openMockDatabase('test-wallet-session')
  await initializeAccounts(database)
  const server = setupServer(...authHandlers(database), ...walletHandlers(database))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    const credentials = { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' }
    const first = await api.post('/auth/login', credentials)
    const second = await api.post('/auth/login', credentials)
    const firstHeaders = { Authorization: `Bearer ${first.data.token}` }
    const secondHeaders = { Authorization: `Bearer ${second.data.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await api.put('/wallets/primary', wallet, { headers: { ...firstHeaders, 'If-Match': '0' } })
    const input = { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }
    const one = await api.post('/wallet-connections', input, { headers: firstHeaders })
    const two = await api.post('/wallet-connections', input, { headers: secondHeaders })
    assert.notEqual(one.data.id, two.data.id)
    assert.equal((await api.post('/auth/logout', {}, { headers: firstHeaders })).status, 204)
    assert.equal((await api.post('/wallet-connections', input, { headers: secondHeaders })).data.id, two.data.id)
    assert.equal((await api.post('/auth/logout', {}, { headers: secondHeaders })).status, 204)
    const third = await api.post('/auth/login', credentials)
    const connected = await api.post('/wallet-connections', input, { headers: { Authorization: `Bearer ${third.data.token}` } })
    assert.notEqual(connected.data.id, two.data.id)
  } finally { server.close(); database.close() }
})
