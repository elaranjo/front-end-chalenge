import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios, { type AxiosAdapter } from 'axios'
import { CheckoutSubmission } from '../src/shared/checkout-submission.ts'
import type { OrderAttemptManager } from '../src/shared/order-attempt.ts'
import type { SessionManager } from '../src/shared/session.ts'
import type { Quote } from '../src/shared/contracts.ts'
import { EventGate } from '../src/realtime/event-gate.ts'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { CheckoutQuoteClient } from '../src/shared/checkout-quote.ts'
import { createQueryReconciliation } from '../src/realtime/query-reconciliation.ts'

const quote = (fingerprint: string, expiresAt = '2026-11-06T00:00:00.000Z'): Quote => ({ id: `quote-${fingerprint}`, cartId: 'user:a', cartRevision: 1, catalogVersion: 1, lines: [{ lineId: 'line', nftId: 'nft', editionId: 'one-of-ten', nftVersion: 1, editionVersion: 1, quantity: 2, unitPrice: '1', lineTotal: '2' }], coupon: null, subtotal: '2', discount: '0', networkFee: '0.016', total: '2.016', network: 'ethereum', expiresAt, fingerprint })
const selection = { walletId: 'wallet', network: 'ethereum' as const, provider: 'metamask' as const, collector: { displayName: 'A', username: 'a', network: 'ethereum' as const, profileName: 'A', address: `0x${'a'.repeat(40)}`, walletType: 'metamask' as const, referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' } }
const connection = { id: 'connection', status: 'connected', walletId: 'wallet', network: 'ethereum', provider: 'metamask', version: 1 }

test('changed or expired quote requires explicit review before order creation', async () => {
  let serverQuote = quote('new')
  const adapter: AxiosAdapter = async (config) => ({ data: serverQuote, status: 200, statusText: 'OK', headers: {}, config })
  let submissions = 0
  const attempts = { hasAttempt: () => false, create: async () => { submissions++; return { id: 'order' } } } as unknown as OrderAttemptManager
  const session = { session: { token: 'token', userId: 'a' }, sessionGeneration: 1 } as unknown as SessionManager
  const gate = new EventGate('a', 'session')
  const checkout = new CheckoutSubmission(axios.create({ adapter }), session, attempts, () => true, () => gate, () => Date.parse('2026-11-05T12:00:00Z'))
  const changed = await checkout.submit(quote('old'), selection, connection)
  assert.equal(changed.status, 'review-required')
  if (changed.status === 'review-required') assert.equal(changed.reason, 'changed')
  assert.equal(submissions, 0)
  const accepted = await checkout.submit(serverQuote, selection, connection)
  assert.equal(accepted.status, 'submitted')
  assert.equal(submissions, 1)
  serverQuote = quote('same')
  const expired = await checkout.submit(quote('same', '2026-11-05T11:00:00.000Z'), selection, connection)
  assert.equal(expired.status, 'review-required')
  if (expired.status === 'review-required') assert.equal(expired.reason, 'expired')
  assert.equal(submissions, 1)
  await assert.rejects(checkout.submit(serverQuote, selection, { ...connection, status: 'disconnected' }))
  await assert.rejects(checkout.submit(serverQuote, { ...selection, collector: { ...selection.collector, email: 'invalid' } }, connection))
  assert.equal(submissions, 1)
})

test('quote expiry uses the server clock when manual time differs from the browser', async () => {
  const manualQuote = quote('manual', '2026-07-29T12:01:00.000Z')
  let serverTime = '2026-07-29T12:00:00.000Z'
  const adapter: AxiosAdapter = async (config) => ({ data: manualQuote, status: 200, statusText: 'OK', headers: { 'x-server-time': serverTime }, config })
  let submissions = 0
  const attempts = { hasAttempt: () => false, create: async () => { submissions++; return { id: 'order' } } } as unknown as OrderAttemptManager
  const session = { session: { token: 'token', userId: 'a' }, sessionGeneration: 1 } as unknown as SessionManager
  const gate = new EventGate('a', 'session')
  const checkout = new CheckoutSubmission(axios.create({ adapter }), session, attempts, () => true, () => gate, () => Date.parse('2026-11-05T12:00:00Z'))
  assert.equal((await checkout.submit(manualQuote, selection, connection)).status, 'submitted')
  serverTime = '2026-07-29T12:01:00.000Z'
  assert.equal((await checkout.submit(manualQuote, selection, connection)).status, 'review-required')
  assert.equal(submissions, 1)
})

test('matching fingerprints cannot silently accept different reviewed values or another owner', async () => {
  const reviewed = quote('same')
  const changed = { ...quote('same'), networkFee: '0.02', total: '2.02' }
  const adapter: AxiosAdapter = async (config) => ({ data: changed, status: 200, statusText: 'OK', headers: {}, config })
  let submissions = 0
  const attempts = { hasAttempt: () => false, create: async () => { submissions++; return { id: 'order' } } } as unknown as OrderAttemptManager
  const session = { session: { token: 'token', userId: 'a' }, sessionGeneration: 1 } as unknown as SessionManager
  const gate = new EventGate('a', 'session')
  const checkout = new CheckoutSubmission(axios.create({ adapter }), session, attempts, () => true, () => gate, () => Date.parse('2026-11-05T12:00:00Z'))
  const result = await checkout.submit(reviewed, selection, connection)
  assert.equal(result.status, 'review-required')
  if (result.status === 'review-required') assert.equal(result.current.total, '2.02')
  await assert.rejects(checkout.submit({ ...reviewed, cartId: 'user:b' }, selection, connection), /owner mismatch/)
  assert.equal(submissions, 0)
})

test('a quote older than an event received during revalidation cannot create an order', async () => {
  let release!: () => void
  const adapter: AxiosAdapter = (config) => new Promise((resolve) => {
    release = () => resolve({ data: quote('same'), status: 200, statusText: 'OK', headers: {}, config })
  })
  let submissions = 0
  const attempts = { hasAttempt: () => false, create: async () => { submissions++; return { id: 'order' } } } as unknown as OrderAttemptManager
  const session = { session: { token: 'token', userId: 'a' }, sessionGeneration: 1 } as unknown as SessionManager
  const gate = new EventGate('a', 'session')
  const checkout = new CheckoutSubmission(axios.create({ adapter }), session, attempts, () => true, () => gate, () => Date.parse('2026-11-05T12:00:00Z'))
  const pending = checkout.submit(quote('same'), selection, connection)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(gate.observeCatalog(2), true)
  release()
  await assert.rejects(pending, /older than the current cart or catalog/)
  assert.equal(submissions, 0)
})

test('a quote cannot overwrite a newer cart revision', async () => {
  const adapter: AxiosAdapter = async (config) => ({ data: quote('same'), status: 200, statusText: 'OK', headers: {}, config })
  const session = { session: { token: 'token', userId: 'a' }, sessionGeneration: 1 } as unknown as SessionManager
  const gate = new EventGate('a', 'session')
  assert.equal(gate.observeCart('user:a', 2, 1), true)
  const client = new CheckoutQuoteClient(axios.create({ adapter }), session, () => gate)
  await assert.rejects(client.fetch({ walletId: 'wallet', network: 'ethereum', provider: 'metamask', cartRevision: 1 }), /older than the current cart or catalog/)
})

test('an active quote can reconcile while checkout confirmation is suspended', async () => {
  let calls = 0
  const adapter: AxiosAdapter = async (config) => {
    calls++
    return { data: quote('same'), status: 200, statusText: 'OK', headers: {}, config }
  }
  const session = { session: { token: 'token', userId: 'a' }, sessionGeneration: 1 } as unknown as SessionManager
  const gate = new EventGate('a', 'session')
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const client = new CheckoutQuoteClient(axios.create({ adapter }), session, () => gate)
  const options = client.query({ walletId: 'wallet', network: 'ethereum', provider: 'metamask', cartRevision: 1 })
  assert.equal(options.staleTime, 0)
  assert.equal(options.retry, false)
  const observer = new QueryObserver(queries, options)
  const unsubscribe = observer.subscribe(() => {})
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Initial quote did not load')), 1000)
      const stop = observer.subscribe((result) => { if (result.isSuccess) { clearTimeout(timer); stop(); resolve() } })
    })
    await createQueryReconciliation(queries, 'a').reconcile({ catalog: false, nftIds: [], orderIds: [] })
    assert.equal(calls, 2)
    assert.equal(observer.getCurrentResult().data?.quote.id, 'quote-same')
  } finally { unsubscribe() }
})
