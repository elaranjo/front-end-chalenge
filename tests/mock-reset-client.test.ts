import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { SessionManager } from '../src/shared/session.ts'
import { clearClientForMockReset } from '../src/shared/mock-reset-client.ts'
import { ORDER_ATTEMPT_KEY } from '../src/shared/order-attempt.ts'
import { visitorId, VISITOR_KEY } from '../src/shared/visitor-cart.ts'
import { CHECKOUT_DRAFT_KEY } from '../src/shared/checkout-draft.ts'

test('client reset clears private and public cache, attempts and visitor identity', async () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } as Storage
  const client = new QueryClient()
  const sessions = new SessionManager(axios.create(), client, storage)
  const oldVisitor = visitorId(storage)
  storage.setItem(ORDER_ATTEMPT_KEY, 'draft')
  storage.setItem(CHECKOUT_DRAFT_KEY, 'draft')
  storage.setItem('unrelated', 'preserved')
  client.setQueryData(['catalog'], 'old')
  client.setQueryData(['cart'], 'private')
  const generation = sessions.sessionGeneration
  const resetGeneration = crypto.randomUUID()
  await clearClientForMockReset(sessions, client, storage, resetGeneration)
  assert.ok(sessions.sessionGeneration > generation)
  assert.equal(storage.getItem(ORDER_ATTEMPT_KEY), null)
  assert.equal(storage.getItem(CHECKOUT_DRAFT_KEY), null)
  assert.equal(storage.getItem(VISITOR_KEY), resetGeneration)
  assert.notEqual(visitorId(storage), oldVisitor)
  assert.equal(storage.getItem('unrelated'), 'preserved')
  assert.equal(client.getQueryCache().getAll().length, 0)
})
