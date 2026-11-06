import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase } from '../src/mocks/database.ts'
import { controlHandlers } from '../src/mocks/control-handlers.ts'
import { catalogHandlers } from '../src/mocks/catalog-handlers.ts'
import { scenarioNetworkHandlers } from '../src/mocks/scenario-network.ts'

test('network scenarios inject errors and out-of-order replies while controls stay available', async () => {
  const db = await openMockDatabase('scenario-network')
  const server = setupServer(...scenarioNetworkHandlers(db), ...controlHandlers(db), ...catalogHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  const reset = (scenario: string) => api.post('/__mock/reset', { scenario, clockMode: 'manual' })
  try {
    assert.equal((await reset('http-503')).status, 200)
    const error = await api.get('/nfts')
    assert.equal(error.status, 503)
    assert.equal(error.data.error.retryable, true)
    assert.equal((await api.get('/__mock/state')).status, 200)
    assert.equal((await reset('network-error')).status, 200)
    await assert.rejects(api.get('/nfts'), (error: unknown) => axios.isAxiosError(error) && !error.response)
    assert.equal((await reset('out-of-order')).status, 200)
    const completed: number[] = []
    const first = api.get('/nfts?q=first').then(() => { completed.push(1) })
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = api.get('/nfts?q=second').then(() => { completed.push(2) })
    await Promise.all([first, second])
    assert.deepEqual(completed, [2, 1])
    await reset('signup-conflict')
    assert.equal((await api.post('/auth/signup', {})).data.error.code, 'ACCOUNT_CONFLICT')
    await reset('validation-errors')
    const invalid = await api.post('/auth/signup', {})
    assert.equal(invalid.status, 422)
    assert.ok(invalid.data.error.fieldErrors.username)
    await reset('session-expired')
    assert.equal((await api.get('/auth/session', { headers: { Authorization: 'Bearer expired' } })).data.error.code, 'SESSION_EXPIRED')
    await reset('coupon-invalid')
    assert.equal((await api.put('/cart/coupon', { code: 'KURIO10' })).data.error.code, 'COUPON_INVALID')
    assert.equal((await reset('default')).status, 200)
    assert.equal((await api.get('/nfts')).data.total, 36)
  } finally { server.close(); db.close() }
})

test('every configured HTTP failure and favorite mutation failure is reproducible', async () => {
  const db = await openMockDatabase('scenario-http-statuses')
  const server = setupServer(...scenarioNetworkHandlers(db), ...controlHandlers(db), ...catalogHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1', validateStatus: () => true })
  try {
    for (const status of [400, 401, 403, 404, 409, 422, 500, 503]) {
      assert.equal((await api.post('/__mock/reset', { scenario: `http-${status}`, clockMode: 'manual' })).status, 200)
      const response = await api.get('/nfts')
      assert.equal(response.status, status)
      assert.equal(response.data.error.code, `SCENARIO_${status}`)
      assert.equal(response.data.error.retryable, status >= 500)
    }
    await api.post('/__mock/reset', { scenario: 'favorite-failure', clockMode: 'manual' })
    const favorite = await api.put('/favorites/emerald-ape-042')
    assert.equal(favorite.status, 503)
    assert.equal(favorite.data.error.retryable, true)
    assert.equal((await api.get('/nfts')).status, 200)
  } finally { server.close(); db.close() }
})

test('slow scenario applies the configured delay and reset removes it', async () => {
  const db = await openMockDatabase('scenario-slow')
  const server = setupServer(...scenarioNetworkHandlers(db), ...controlHandlers(db), ...catalogHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  try {
    await api.post('/__mock/reset', { scenario: 'slow', clockMode: 'manual' })
    const start = performance.now()
    assert.equal((await api.get('/nfts')).data.total, 36)
    assert.ok(performance.now() - start >= 1900)
    await api.post('/__mock/reset', { scenario: 'default', clockMode: 'manual' })
    const afterReset = performance.now()
    assert.equal((await api.get('/nfts')).data.total, 36)
    assert.ok(performance.now() - afterReset < 1500)
  } finally { server.close(); db.close() }
})
