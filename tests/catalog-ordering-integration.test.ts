import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { openMockDatabase } from '../src/mocks/database.ts'
import { controlHandlers } from '../src/mocks/control-handlers.ts'
import { catalogHandlers } from '../src/mocks/catalog-handlers.ts'
import { scenarioNetworkHandlers } from '../src/mocks/scenario-network.ts'
import { catalogQueries } from '../src/shared/catalog-queries.ts'
import { EventGate } from '../src/realtime/event-gate.ts'

test('a delayed previous filter cannot replace the currently observed catalog', async () => {
  const db = await openMockDatabase('catalog-filter-order')
  const server = setupServer(...scenarioNetworkHandlers(db), ...controlHandlers(db), ...catalogHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  try {
    await api.post('/__mock/reset', { scenario: 'out-of-order', clockMode: 'manual' })
    const gate = new EventGate(null, 'visitor')
    const catalog = catalogQueries(api, () => gate)
    const observer = new QueryObserver(client, catalog.list({ q: 'Emerald' }))
    const results: string[] = []
    const unsubscribe = observer.subscribe((result) => { if (result.data) results.push(result.data.items[0]?.name ?? '') })
    try {
      await new Promise((resolve) => setTimeout(resolve, 30))
      observer.setOptions(catalog.list({ q: 'Golden' }))
      await new Promise((resolve) => setTimeout(resolve, 1000))
      assert.ok(results.length > 0)
      assert.ok(results.every((name) => name.startsWith('Golden')))
      assert.ok(observer.getCurrentResult().data?.items.every((item) => item.name.startsWith('Golden')))
    } finally { unsubscribe() }
  } finally { server.close(); db.close() }
})
