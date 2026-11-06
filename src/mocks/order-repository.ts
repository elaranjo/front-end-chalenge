import type { NFT, Quote, Wallet } from '../shared/contracts.ts'
import { consumePurchased, type StoredCart } from './cart-domain.ts'

export type OrderInput = {
  quoteId: string; quoteFingerprint: string; cartRevision: number; walletId: string
  provider: string; network: string; connectionId: string; collector: Record<string, string>
}
type PersistedQuote = Quote & { ownerUserId?: string; walletId?: string; walletVersion?: number; provider?: string; feeVersion?: number }
export type StoredOrder = {
  id: string; version: number; ownerUserId: string; status: 'pending' | 'confirmed' | 'declined'
  createdAt: string; updatedAt: string; snapshot: { quote: Quote; collector: Record<string, string>; walletId: string; wallet: Wallet; provider: string; network: string; items: Array<{ nft: NFT; lineId: string; editionId: string; quantity: number; unitPrice: string; lineTotal: string }> }
  transaction?: { id: string; network: string; simulated: true }
  declineReason?: string
  resolveAt?: string
  intendedOutcome?: 'confirmed' | 'declined'
}

/** Terminal effects and the ledger entry are committed with the state transition. */
export async function resolvePendingOrder(database: IDBDatabase, owner: string, orderId: string, outcome: 'confirmed' | 'declined', now: number): Promise<StoredOrder> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['orders', 'ledger', 'carts', 'catalog', 'scenario', 'reservations', 'outbox'], 'readwrite')
    const orderRequest = tx.objectStore('orders').get(orderId)
    const cartRequest = tx.objectStore('carts').get(`user:${owner}`)
    const catalogRequest = tx.objectStore('catalog').getAll()
    const metaRequest = tx.objectStore('scenario').get('catalog-meta')
    const reservationsRequest = tx.objectStore('reservations').getAll()
    const effectRequest = tx.objectStore('ledger').get(`order-effect:${orderId}`)
    let reads = 0
    let result: StoredOrder
    let failure: unknown
    const ready = () => {
      if (++reads !== 6) return
      try {
        const order = orderRequest.result as StoredOrder | undefined
        if (!order || order.ownerUserId !== owner) throw new OrderConflict('ORDER_NOT_FOUND')
        if (order.status !== 'pending') {
          if (order.status !== outcome) throw new OrderConflict('ORDER_TERMINAL')
          result = order
          return
        }
        if (effectRequest.result) throw new Error('Pending order has an existing effect')
        const reservations = (reservationsRequest.result as Array<{ id: string; orderId: string; nftId: string; editionId: string; quantity: number }>).filter((item) => item.orderId === orderId)
        if (reservations.length !== order.snapshot.items.length) throw new Error('Order reservation is incomplete')
        if (outcome === 'confirmed') {
          const cart = cartRequest.result as StoredCart | undefined
          if (cart) tx.objectStore('carts').put(consumePurchased(cart, order.snapshot.items))
        } else {
          const catalog = catalogRequest.result as NFT[]
          for (const reservation of reservations) {
            const nft = catalog.find((item) => item.id === reservation.nftId)
            const edition = nft?.editions.find((item) => item.id === reservation.editionId)
            if (!nft || !edition) throw new Error('Reserved edition is missing')
            edition.available += reservation.quantity
            edition.version++
            nft.version++
            tx.objectStore('catalog').put(nft)
          }
          tx.objectStore('scenario').put({ id: 'catalog-meta', catalogVersion: metaRequest.result.catalogVersion + 1 })
          for (const nftId of new Set(reservations.map((entry) => entry.nftId))) {
            const nft = catalog.find((item) => item.id === nftId)!
            const eventId = crypto.randomUUID()
            tx.objectStore('outbox').add({ id: eventId, eventId, type: 'nft.updated', resourceId: nft.id, version: nft.version, catalogVersion: metaRequest.result.catalogVersion + 1, occurredAt: new Date(now).toISOString(), payload: { nftId: nft.id, editions: nft.editions } })
          }
        }
        for (const reservation of reservations) tx.objectStore('reservations').delete(reservation.id)
        result = { ...order, version: order.version + 1, status: outcome, updatedAt: new Date(now).toISOString(), ...(outcome === 'confirmed' ? { transaction: { id: `0x${crypto.randomUUID().replaceAll('-', '')}`, network: order.snapshot.network, simulated: true as const } } : { declineReason: 'Pagamento recusado na simulação' }) }
        tx.objectStore('orders').put(result)
        tx.objectStore('ledger').add({ id: `order-effect:${orderId}`, orderId, outcome })
        const eventId = crypto.randomUUID()
        tx.objectStore('outbox').add({ id: eventId, eventId, type: 'order.updated', resourceId: orderId, version: result.version, occurredAt: result.updatedAt, ownerUserId: owner, payload: { orderId, status: outcome } })
      } catch (error) { failure = error; tx.abort() }
    }
    for (const request of [orderRequest, cartRequest, catalogRequest, metaRequest, reservationsRequest, effectRequest]) request.onsuccess = ready
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Order resolution aborted'))
  })
}

export class OrderConflict extends Error {
  readonly code: string
  constructor(code: string) { super(code); this.code = code }
}

/** The payload hash is calculated before the transaction; no async crypto runs inside IndexedDB. */
export async function hashOrderInput(input: OrderInput): Promise<string> {
  const canonical = JSON.stringify({ quoteId: input.quoteId, quoteFingerprint: input.quoteFingerprint, cartRevision: input.cartRevision, walletId: input.walletId, provider: input.provider, network: input.network, connectionId: input.connectionId, collector: Object.fromEntries(Object.entries(input.collector).sort(([a], [b]) => a.localeCompare(b))) })
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('')
}

/** Reservation, idempotency ledger and immutable purchase snapshot commit together. */
export async function createPendingOrder(database: IDBDatabase, owner: string, key: string, input: OrderInput, now: number, auth?: { token: string; sessionId: string }): Promise<{ order: StoredOrder; created: boolean }> {
  if (!owner || !key) throw new TypeError('Owner and idempotency key are required')
  const fingerprint = await hashOrderInput(input)
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['orders', 'ledger', 'quotes', 'carts', 'catalog', 'scenario', 'wallets', 'reservations', 'outbox', 'sessions'], 'readwrite')
    const ledger = tx.objectStore('ledger')
    const orders = tx.objectStore('orders')
    const ledgerRequest = ledger.get(`order:${owner}:${key}`)
    const quoteRequest = tx.objectStore('quotes').get(input.quoteId)
    const cartRequest = tx.objectStore('carts').get(`user:${owner}`)
    const catalogRequest = tx.objectStore('catalog').getAll()
    const metaRequest = tx.objectStore('scenario').get('catalog-meta')
    const connectionRequest = tx.objectStore('scenario').get(`connection:${owner}`)
    const behaviorRequest = tx.objectStore('scenario').get('payment-behavior')
    const feeRequest = tx.objectStore('scenario').get('network-fee')
    const couponRequest = tx.objectStore('scenario').get('coupon:KURIO10')
    const walletRequest = tx.objectStore('wallets').get(input.walletId)
    const sessionRequest = auth ? tx.objectStore('sessions').get(auth.token) : undefined
    let reads = 0
    let result: { order: StoredOrder; created: boolean }
    let failure: unknown
    const ready = () => {
      if (++reads !== (sessionRequest ? 11 : 10)) return
      try {
        if (auth && (!sessionRequest?.result || sessionRequest.result.userId !== owner || sessionRequest.result.sessionId !== auth.sessionId || Date.parse(sessionRequest.result.expiresAt) <= now)) throw new OrderConflict('SESSION_INVALID')
        const prior = ledgerRequest.result as { fingerprint: string; orderId: string } | undefined
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new OrderConflict('IDEMPOTENCY_CONFLICT')
          const existing = orders.get(prior.orderId)
          existing.onsuccess = () => {
            if (!existing.result) { failure = new Error('Order ledger points to missing order'); tx.abort(); return }
            result = { order: existing.result, created: false }
          }
          return
        }
        const quote = quoteRequest.result as PersistedQuote | undefined
        const cart = cartRequest.result as StoredCart | undefined
        const connection = connectionRequest.result
        const catalog = catalogRequest.result as NFT[]
        if (!quote || quote.ownerUserId !== owner || quote.walletId !== input.walletId || quote.provider !== input.provider || quote.network !== input.network || quote.fingerprint !== input.quoteFingerprint || Date.parse(quote.expiresAt) <= now) throw new OrderConflict('STALE_QUOTE')
        if (!cart || cart.revision !== input.cartRevision || quote.cartRevision !== cart.revision || quote.catalogVersion !== metaRequest.result?.catalogVersion || (quote.feeVersion ?? 0) !== (feeRequest.result?.version ?? 0)) throw new OrderConflict('STALE_QUOTE')
        if (quote.coupon && (couponRequest.result?.expired || quote.coupon.version !== (couponRequest.result?.version ?? 1))) throw new OrderConflict('STALE_QUOTE')
        const wallet = walletRequest.result as (Wallet & { ownerUserId: string }) | undefined
        if (!wallet || wallet.ownerUserId !== owner || wallet.version !== quote.walletVersion || wallet.network !== input.network) throw new OrderConflict('STALE_QUOTE')
        if (!connection || (auth && connection.sessionId !== auth.sessionId) || connection.connectionId !== input.connectionId || connection.status !== 'connected' || connection.walletId !== input.walletId || connection.provider !== input.provider || connection.network !== input.network) throw new OrderConflict('CONNECTION_INVALID')
        if (!quote.lines.length || quote.lines.length !== cart.lines.length) throw new OrderConflict('STALE_QUOTE')
        const items = quote.lines.map((line) => {
          const cartLine = cart.lines.find((entry) => entry.lineId === line.lineId)
          const nft = catalog.find((entry) => entry.id === line.nftId)
          const edition = nft?.editions.find((entry) => entry.id === line.editionId)
          if (!cartLine || cartLine.nftId !== line.nftId || cartLine.editionId !== line.editionId || cartLine.quantity !== line.quantity || !nft || !edition || nft.version !== line.nftVersion || edition.version !== line.editionVersion || edition.unitPrice !== line.unitPrice || edition.available < line.quantity) throw new OrderConflict('STALE_QUOTE')
          return { nft: structuredClone(nft), lineId: line.lineId, editionId: line.editionId, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal }
        })
        const timestamp = new Date(now).toISOString()
        const { ownerUserId: _walletOwner, ...walletSnapshot } = wallet
        const order: StoredOrder = { id: crypto.randomUUID(), version: 1, ownerUserId: owner, status: 'pending', createdAt: timestamp, updatedAt: timestamp, resolveAt: new Date(now + 2000).toISOString(), intendedOutcome: behaviorRequest.result?.decline ? 'declined' : 'confirmed', snapshot: { quote: structuredClone(quote), collector: { ...input.collector }, walletId: input.walletId, wallet: walletSnapshot, provider: input.provider, network: input.network, items } }
        for (const item of items) {
          const nft = catalog.find((entry) => entry.id === item.nft.id)!
          const edition = nft.editions.find((entry) => entry.id === item.editionId)!
          edition.available -= item.quantity
          edition.version++
          nft.version++
          tx.objectStore('catalog').put(nft)
          tx.objectStore('reservations').add({ id: `${order.id}:${item.lineId}`, orderId: order.id, nftId: nft.id, editionId: edition.id, quantity: item.quantity })
        }
        tx.objectStore('scenario').put({ id: 'catalog-meta', catalogVersion: metaRequest.result.catalogVersion + 1 })
        for (const nftId of new Set(items.map((item) => item.nft.id))) {
          const nft = catalog.find((entry) => entry.id === nftId)!
          const eventId = crypto.randomUUID()
          tx.objectStore('outbox').add({ id: eventId, eventId, type: 'nft.updated', resourceId: nft.id, version: nft.version, catalogVersion: metaRequest.result.catalogVersion + 1, occurredAt: timestamp, payload: { nftId: nft.id, editions: nft.editions } })
        }
        orders.add(order)
        ledger.add({ id: `order:${owner}:${key}`, fingerprint, orderId: order.id })
        const eventId = crypto.randomUUID()
        tx.objectStore('outbox').add({ id: eventId, eventId, type: 'order.updated', resourceId: order.id, version: order.version, occurredAt: timestamp, ownerUserId: owner, payload: { orderId: order.id, status: 'pending' } })
        result = { order, created: true }
      } catch (error) { failure = error; tx.abort() }
    }
    for (const request of [ledgerRequest, quoteRequest, cartRequest, catalogRequest, metaRequest, connectionRequest, behaviorRequest, feeRequest, couponRequest, walletRequest]) request.onsuccess = ready
    if (sessionRequest) sessionRequest.onsuccess = ready
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Order transaction aborted'))
  })
}

export async function findOrder(database: IDBDatabase, owner: string, selector: { orderId: string } | { key: string }, now: number, auth?: { token: string; sessionId: string }): Promise<StoredOrder | undefined> {
  const order = await new Promise<StoredOrder | undefined>((resolve, reject) => {
    const tx = database.transaction(['orders', 'ledger', 'sessions'], 'readonly')
    const session = auth ? tx.objectStore('sessions').get(auth.token) : undefined
    let orderRequest: IDBRequest | undefined
    if ('orderId' in selector) orderRequest = tx.objectStore('orders').get(selector.orderId)
    else {
      const ledger = tx.objectStore('ledger').get(`order:${owner}:${selector.key}`)
      ledger.onsuccess = () => { if (ledger.result?.orderId) orderRequest = tx.objectStore('orders').get(ledger.result.orderId) }
    }
    tx.oncomplete = () => {
      if (auth && (!session?.result || session.result.userId !== owner || session.result.sessionId !== auth.sessionId || Date.parse(session.result.expiresAt) <= now)) reject(new OrderConflict('SESSION_INVALID'))
      else if (orderRequest?.result && orderRequest.result.ownerUserId !== owner) reject(new OrderConflict('FORBIDDEN'))
      else resolve(orderRequest?.result)
    }
    tx.onabort = () => reject(tx.error ?? new Error('Order read failed'))
  })
  if (order?.status === 'pending' && order.resolveAt && Date.parse(order.resolveAt) <= now && order.intendedOutcome) {
    return resolvePendingOrder(database, owner, order.id, order.intendedOutcome, now)
  }
  return order
}
