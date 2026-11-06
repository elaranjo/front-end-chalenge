import { cart, checkout, checkoutQuotes, orderAttempts, wallets } from '../../src/app/marketplace-services.ts'
import { realtime } from '../../src/app/realtime.ts'
import { authFlow } from '../../src/app/session.ts'
import { QueryObserver } from '@tanstack/react-query'
import { queryClient } from '../../src/app/query-client.ts'
import { api } from '../../src/shared/http.ts'
import { accountQueries } from '../../src/app/private-queries.ts'

async function waitForReady() {
  const deadline = Date.now() + 8000
  while (!realtime.isReady) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for realtime')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

export async function runCartMergeProbe() {
  await waitForReady()
  const visitorCart = await cart.reconcile()
  const added = await cart.add({ nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2, mutationId: crypto.randomUUID() }, visitorCart.revision)
  const login = await authFlow.login('colecionador.a@kurio.test', 'DemoA!2026')
  await waitForReady()
  const merged = await cart.reconcile()
  return { visitorQuantity: added.lines[0]?.quantity, owner: merged.id, quantity: merged.lines[0]?.quantity, userId: login.session.userId }
}

async function createPendingOrder() {
  await authFlow.login('colecionador.a@kurio.test', 'DemoA!2026')
  await waitForReady()
  const empty = await cart.reconcile()
  const current = await cart.add({ nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2, mutationId: crypto.randomUUID() }, empty.revision)
  const fields = { displayName: 'A', nickname: 'Principal', network: 'ethereum' as const, profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask' as const, referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
  const wallet = await wallets.save('primary', fields, 0)
  const selection = { walletId: wallet.id, provider: wallet.type, network: wallet.network }
  const connection = await wallets.connect(selection)
  await waitForReady()
  const { quote } = await checkoutQuotes.fetch({ ...selection, cartRevision: current.revision })
  const collector = { displayName: 'A', username: 'a', network: fields.network, profileName: 'A', address: fields.address, walletType: fields.type, referralCode: 'DEMO', email: fields.email, ensName: fields.ensName }
  const result = await checkout.submit(quote, { ...selection, collector }, connection)
  if (result.status !== 'submitted') throw new Error('Unexpected quote change')
  return result.order
}

export async function runCheckoutProbe() {
  const order = await createPendingOrder()
  const deadline = Date.now() + 8000
  let recovered = await orderAttempts.recover()
  while (recovered.status === 'pending' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    recovered = await orderAttempts.recover()
  }
  return { createdId: order.id, recoveredId: recovered.id, status: recovered.status, total: recovered.snapshot.quote.total }
}

export async function runReconnectOrderProbe() {
  const order = await createPendingOrder()
  const observer = new QueryObserver(queryClient, accountQueries.order(order.id))
  const unsubscribe = observer.subscribe(() => {})
  try {
    const deadline = Date.now() + 8000
    while (!observer.getCurrentResult().data && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25))
    if (observer.getCurrentResult().data?.status !== 'pending') throw new Error('Expected pending order')
    realtime.stop()
    await api.post('/__mock/actions', { action: 'resolveOrder', payload: { orderId: order.id, ownerUserId: order.ownerUserId, outcome: 'confirmed' } })
    realtime.start()
    await waitForReady()
    const recovered = observer.getCurrentResult().data
    return { original: order.id, recovered: recovered?.id, status: recovered?.status, attempt: (await orderAttempts.recover()).id }
  } finally { unsubscribe() }
}

export async function runQuoteEventProbe() {
  await authFlow.login('colecionador.a@kurio.test', 'DemoA!2026')
  await waitForReady()
  const empty = await cart.reconcile()
  const current = await cart.add({ nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2, mutationId: crypto.randomUUID() }, empty.revision)
  const fields = { displayName: 'A', nickname: 'Principal', network: 'ethereum' as const, profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask' as const, referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
  const wallet = await wallets.save('primary', fields, 0)
  const selection = { walletId: wallet.id, provider: wallet.type, network: wallet.network }
  const connection = await wallets.connect(selection)
  const observer = new QueryObserver(queryClient, checkoutQuotes.query({ ...selection, cartRevision: current.revision }))
  const unsubscribe = observer.subscribe(() => {})
  try {
    const deadline = Date.now() + 8000
    while (!observer.getCurrentResult().data && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25))
    const previous = observer.getCurrentResult().data?.quote
    if (!previous) throw new Error('Initial quote did not load')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await waitForReady()
    await api.post('/__mock/actions', { action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-ten', unitPrice: '1.50' } })
    while (observer.getCurrentResult().data?.quote.total !== '3.016' && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25))
    await waitForReady()
    const collector = { displayName: 'A', username: 'a', network: fields.network, profileName: 'A', address: fields.address, walletType: fields.type, referralCode: 'DEMO', email: fields.email, ensName: fields.ensName }
    const review = await checkout.submit(previous, { ...selection, collector }, connection)
    return { previous: previous.total, current: observer.getCurrentResult().data?.quote.total, status: review.status, hasAttempt: orderAttempts.hasAttempt() }
  } finally { unsubscribe() }
}
