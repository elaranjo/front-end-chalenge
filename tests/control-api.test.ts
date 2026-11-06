import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase } from '../src/mocks/database.ts'
import { catalogHandlers, initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { controlHandlers } from '../src/mocks/control-handlers.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'

test('catalog action commits price, stock, versions and event together', async () => {
  const db = await openMockDatabase('control-api')
  await initializeCatalog(db)
  const server = setupServer(...catalogHandlers(db), ...controlHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    const input = { action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-ten', unitPrice: '2.45', available: 3 } }
    assert.equal((await api.post('/__mock/actions', input)).status, 200)
    const nft = (await api.get('/nfts/emerald-ape-042')).data
    const edition = nft.editions.find((item: { id: string }) => item.id === 'one-of-ten')
    assert.equal(edition.unitPrice, '2.45')
    assert.equal(edition.available, 3)
    assert.equal(edition.version, 2)
    assert.equal(nft.version, 2)
    const events = await new Promise<any[]>((resolve, reject) => { const tx = db.transaction('outbox'); const req = tx.objectStore('outbox').getAll(); tx.oncomplete = () => resolve(req.result); tx.onabort = () => reject(tx.error) })
    assert.equal(events.length, 1)
    assert.equal(events[0].catalogVersion, 2)
    assert.equal(events[0].version, nft.version)
    assert.deepEqual(events[0].payload.editions, nft.editions)
    assert.equal((await api.post('/__mock/actions', { ...input, payload: { ...input.payload, available: -1 } })).status, 422)
    assert.equal((await api.post('/__mock/actions', { ...input, payload: { ...input.payload, nftId: 'missing' } })).status, 404)
    assert.equal((await api.get('/nfts/emerald-ape-042')).data.version, 2)
  } finally { server.close(); db.close() }
})

test('expiring one session revokes its access without affecting another session', async () => {
  const db = await openMockDatabase('control-session')
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...controlHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    const a = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const b = await api.post('/auth/login', { email: 'colecionador.b@kurio.test', password: 'DemoB!2026' })
    const expired = await api.post('/__mock/actions', { action: 'expireSession', payload: { sessionId: a.data.sessionId } })
    assert.equal(expired.status, 200)
    assert.equal(expired.data.token, undefined)
    assert.equal((await api.get('/auth/session', { headers: { Authorization: `Bearer ${a.data.token}` } })).status, 401)
    assert.equal((await api.get('/auth/session', { headers: { Authorization: `Bearer ${b.data.token}` } })).status, 200)
  } finally { server.close(); db.close() }
})
