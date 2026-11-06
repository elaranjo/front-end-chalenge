import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { openMockDatabase } from '../src/mocks/database.ts'
import { authHandlers, initializeAccounts } from '../src/mocks/auth-handlers.ts'
import { initializeCatalog } from '../src/mocks/catalog-handlers.ts'
import { cartHandlers } from '../src/mocks/cart-handlers.ts'
import { walletHandlers } from '../src/mocks/wallet-handlers.ts'
import { createPendingOrder, resolvePendingOrder, OrderConflict } from '../src/mocks/order-repository.ts'
import { mutateStoredCart, readStoredCart } from '../src/mocks/cart-repository.ts'
import { controlHandlers } from '../src/mocks/control-handlers.ts'

test('concurrent purchase retries reserve once and conflicting payloads fail', async () => {
  const db = await openMockDatabase('test-orders')
  await initializeCatalog(db)
  await initializeAccounts(db)
  const server = setupServer(...authHandlers(db), ...cartHandlers(db), ...walletHandlers(db), ...controlHandlers(db))
  server.listen({ onUnhandledRequest: 'error' })
  const api = axios.create({ baseURL: 'http://localhost/api/v1' })
  try {
    const login = await api.post('/auth/login', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const headers = { Authorization: `Bearer ${login.data.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await api.put('/wallets/primary', wallet, { headers: { ...headers, 'If-Match': '0' } })
    let connection = await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })
    const cart = await api.post('/cart/items', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { headers: { ...headers, 'If-Match': '0', 'X-Mutation-Id': 'add-1' } })
    const oldQuote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.data.revision }, { headers })
    const editedWallet = { ...wallet, address: `0x${'b'.repeat(40)}` }
    await api.put('/wallets/primary', editedWallet, { headers: { ...headers, 'If-Match': '1' } })
    const staleWalletInput = { quoteId: oldQuote.data.id, quoteFingerprint: oldQuote.data.fingerprint, cartRevision: cart.data.revision, walletId: saved.data.id, provider: 'metamask', network: 'ethereum', connectionId: connection.data.id, collector: { name: 'Demo' } }
    await assert.rejects(createPendingOrder(db, 'collector-a', 'old-wallet', staleWalletInput, Date.now()), (e: unknown) => e instanceof OrderConflict && e.code === 'STALE_QUOTE')
    connection = await api.post('/wallet-connections', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum' }, { headers })
    await api.post('/__mock/actions', { action: 'updateFee', payload: { amount: '0.026' } })
    const staleInput = { quoteId: oldQuote.data.id, quoteFingerprint: oldQuote.data.fingerprint, cartRevision: cart.data.revision, walletId: saved.data.id, provider: 'metamask', network: 'ethereum', connectionId: connection.data.id, collector: { name: 'Demo' } }
    await assert.rejects(createPendingOrder(db, 'collector-a', 'old-fee', staleInput, Date.now()), (e: unknown) => e instanceof OrderConflict && e.code === 'STALE_QUOTE')
    const quote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.data.revision }, { headers })
    const input = { quoteId: quote.data.id, quoteFingerprint: quote.data.fingerprint, cartRevision: cart.data.revision, walletId: saved.data.id, provider: 'metamask', network: 'ethereum', connectionId: connection.data.id, collector: { name: 'Demo' } }
    await assert.rejects(createPendingOrder(db, 'collector-a', 'expired-ttl', input, Date.parse(quote.data.expiresAt)), (e: unknown) => e instanceof OrderConflict && e.code === 'STALE_QUOTE')
    const [a, b] = await Promise.all([createPendingOrder(db, 'collector-a', 'same-key', input, Date.now()), createPendingOrder(db, 'collector-a', 'same-key', input, Date.now())])
    assert.equal(a.order.id, b.order.id)
    assert.deepEqual([a.created, b.created].sort(), [false, true])
    assert.equal(a.order.snapshot.quote.total, '2.406')
    assert.equal(a.order.snapshot.wallet.address, editedWallet.address)
    const records = await new Promise<{ reservations: any[]; ledger: any[] }>((resolve, reject) => {
      const tx = db.transaction(['reservations', 'ledger'])
      const reservations = tx.objectStore('reservations').getAll()
      const ledger = tx.objectStore('ledger').getAll()
      tx.oncomplete = () => resolve({ reservations: reservations.result, ledger: ledger.result })
      tx.onabort = () => reject(tx.error)
    })
    assert.equal(records.reservations.filter((item) => item.orderId === a.order.id).length, 1)
    assert.equal(records.ledger.filter((item) => item.orderId === a.order.id).length, 1)
    assert.equal(records.ledger.some((item) => item.id === 'order:collector-a:expired-ttl'), false)
    await assert.rejects(createPendingOrder(db, 'collector-a', 'same-key', { ...input, collector: { name: 'Alterado' } }, Date.now()), (e: unknown) => e instanceof OrderConflict && e.code === 'IDEMPOTENCY_CONFLICT')
    await assert.rejects(createPendingOrder(db, 'collector-a', 'new-key', input, Date.now()), (e: unknown) => e instanceof OrderConflict && e.code === 'STALE_QUOTE')
    const detail = await new Promise<any>((resolve, reject) => { const tx = db.transaction('catalog'); const req = tx.objectStore('catalog').get('emerald-ape-042'); tx.oncomplete = () => resolve(req.result); tx.onabort = () => reject(tx.error) })
    assert.equal(detail.editions.find((entry: { id: string }) => entry.id === 'one-of-ten').available, 8)
    const owner = { kind: 'user' as const, id: 'collector-a' }
    await mutateStoredCart(db, owner, { kind: 'change', lineId: cart.data.lines[0].lineId, quantity: 4, revision: cart.data.revision })
    const [confirmed, retried] = await Promise.all([resolvePendingOrder(db, owner.id, a.order.id, 'confirmed', Date.now()), resolvePendingOrder(db, owner.id, a.order.id, 'confirmed', Date.now())])
    assert.equal(confirmed.status, 'confirmed')
    assert.deepEqual(confirmed, retried)
    assert.equal(confirmed.transaction?.simulated, true)
    assert.equal((await readStoredCart(db, owner)).lines[0].quantity, 2)
    await assert.rejects(resolvePendingOrder(db, owner.id, a.order.id, 'declined', Date.now()), (e: unknown) => e instanceof OrderConflict && e.code === 'ORDER_TERMINAL')
    await assert.rejects(resolvePendingOrder(db, 'collector-b', a.order.id, 'confirmed', Date.now()), (e: unknown) => e instanceof OrderConflict && e.code === 'ORDER_NOT_FOUND')
    const remaining = await readStoredCart(db, owner)
    const secondQuote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: remaining.revision }, { headers })
    const secondInput = { ...input, quoteId: secondQuote.data.id, quoteFingerprint: secondQuote.data.fingerprint, cartRevision: remaining.revision }
    const pending = await createPendingOrder(db, owner.id, 'declined-attempt', secondInput, Date.now())
    const declined = await resolvePendingOrder(db, owner.id, pending.order.id, 'declined', Date.now())
    assert.equal(declined.status, 'declined')
    assert.equal((await readStoredCart(db, owner)).lines[0].quantity, 2)
    const restored = await new Promise<any>((resolve, reject) => { const tx = db.transaction('catalog'); const req = tx.objectStore('catalog').get('emerald-ape-042'); tx.oncomplete = () => resolve(req.result); tx.onabort = () => reject(tx.error) })
    assert.equal(restored.editions.find((entry: { id: string }) => entry.id === 'one-of-ten').available, 8)
    const events = await new Promise<any[]>((resolve, reject) => { const tx = db.transaction('outbox'); const req = tx.objectStore('outbox').getAll(); tx.oncomplete = () => resolve(req.result); tx.onabort = () => reject(tx.error) })
    assert.equal(events.length, 7)
    assert.equal(new Set(events.map((event) => event.eventId)).size, events.length)
    assert.deepEqual(events.filter((event) => event.type === 'order.updated' && event.resourceId === a.order.id).map((event) => event.payload.status).sort(), ['confirmed', 'pending'])
    const thirdQuote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: remaining.revision }, { headers })
    const thirdInput = { ...input, quoteId: thirdQuote.data.id, quoteFingerprint: thirdQuote.data.fingerprint, cartRevision: remaining.revision }
    const third = await createPendingOrder(db, owner.id, 'recreated-line', thirdInput, Date.now())
    const oldLineId = remaining.lines[0].lineId
    const removed = await mutateStoredCart(db, owner, { kind: 'remove', lineId: oldLineId, revision: remaining.revision })
    const recreated = await mutateStoredCart(db, owner, { kind: 'add', nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 1, revision: removed.revision, mutationId: 'new-line' })
    assert.notEqual(recreated.lines[0].lineId, oldLineId)
    const controlled = await api.post('/__mock/actions', { action: 'resolveOrder', payload: { ownerUserId: owner.id, orderId: third.order.id, outcome: 'confirmed' } })
    assert.equal(controlled.data.status, 'confirmed')
    const controlledAgain = await api.post('/__mock/actions', { action: 'resolveOrder', payload: { ownerUserId: owner.id, orderId: third.order.id, outcome: 'confirmed' } })
    assert.deepEqual(controlledAgain.data, controlled.data)
    const afterRecreated = await readStoredCart(db, owner)
    assert.deepEqual(afterRecreated.lines.map(({ lineId, quantity }) => [lineId, quantity]), [[recreated.lines[0].lineId, 1]])
    const withCoupon = await api.put('/cart/coupon', { code: 'KURIO10' }, { headers: { ...headers, 'If-Match': String(afterRecreated.revision) } })
    const couponQuote = await api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: withCoupon.data.revision }, { headers })
    assert.equal(couponQuote.data.coupon.code, 'KURIO10')
    await api.post('/__mock/actions', { action: 'expireCoupon', payload: { code: 'KURIO10' } })
    const expiredInput = { ...input, quoteId: couponQuote.data.id, quoteFingerprint: couponQuote.data.fingerprint, cartRevision: withCoupon.data.revision }
    await assert.rejects(createPendingOrder(db, owner.id, 'expired-coupon', expiredInput, Date.now()), (e: unknown) => e instanceof OrderConflict && e.code === 'STALE_QUOTE')
    const expiredCart = await api.get('/cart', { headers })
    assert.equal(expiredCart.data.quote, null)
    assert.deepEqual(expiredCart.data.adjustments, ['COUPON_EXPIRED'])
    await assert.rejects(api.post('/quotes', { walletId: saved.data.id, provider: 'metamask', network: 'ethereum', cartRevision: withCoupon.data.revision }, { headers }), (e: unknown) => axios.isAxiosError(e) && e.response?.data.error.code === 'COUPON_EXPIRED')
    const withoutCoupon = await api.delete('/cart/coupon', { headers: { ...headers, 'If-Match': String(withCoupon.data.revision) } })
    assert.equal(withoutCoupon.data.couponCode, null)
    assert.ok(withoutCoupon.data.quote)
    await api.put('/wallets/primary', { ...wallet, address: `0x${'c'.repeat(40)}` }, { headers: { ...headers, 'If-Match': '2' } })
    await api.post('/__mock/actions', { action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-ten', unitPrice: '9.50' } })
    const receipt = await resolvePendingOrder(db, owner.id, a.order.id, 'confirmed', Date.now())
    assert.equal(receipt.snapshot.wallet.address, editedWallet.address)
    assert.deepEqual(receipt.snapshot, confirmed.snapshot)
  } finally { server.close(); db.close() }
})
