import type { NFT } from '../shared/contracts.ts'
import { addLine, changeLine, removeLine, mergeLines, type StoredCart, type CartLine, type CartAdjustment } from './cart-domain.ts'

type Owner = { kind: 'visitor' | 'user'; id: string }
export type Authorization = { token: string; sessionId: string; now: number }
export function assertSession(request: IDBRequest | undefined, ownerId: string, auth?: Authorization) {
  if (auth && (!request?.result || request.result.userId !== ownerId || request.result.sessionId !== auth.sessionId || Date.parse(request.result.expiresAt) <= auth.now)) throw new Error('SESSION_INVALID')
}
type Add = { kind: 'add'; nftId: string; editionId: CartLine['editionId']; quantity: number; revision: number; mutationId: string }
type Change = { kind: 'change'; lineId: string; quantity: number; revision: number }
type Remove = { kind: 'remove'; lineId: string; revision: number }
type Mutation = Add | Change | Remove
const cartId = (owner: Owner) => `${owner.kind}:${owner.id}`
const empty = (owner: Owner): StoredCart => ({ id: cartId(owner), ownerKind: owner.kind, revision: 0, lines: [], couponCode: null })

/** Create the deterministic cart for a visual scenario and its owner. */
export function createVisualCart(owner: Owner, name: 'visual-mobile' | 'visual-desktop'): StoredCart {
  const items: Array<[string, CartLine['editionId'], number]> = name === 'visual-mobile'
    ? [['emerald-ape-042', 'one-of-fifty', 1], ['violet-nomad-314', 'one-of-one', 1], ['ivory-baron-088', 'one-of-ten', 2], ['golden-beat-207', 'one-of-fifty', 2]]
    : [['emerald-ape-042', 'one-of-fifty', 2], ['violet-nomad-314', 'one-of-fifty', 6], ['ivory-baron-088', 'one-of-fifty', 9]]
  return { ...empty(owner), revision: 1, lines: items.map(([nftId, editionId, quantity]) => ({ lineId: crypto.randomUUID(), nftId, editionId, quantity })) }
}

/** Claim the visual fixture once per reset, for the first cart owner to request it. */
export async function claimVisualCart(database: IDBDatabase, owner: Owner, auth?: Authorization): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['scenario', 'carts', 'sessions'], 'readwrite')
    const scenarios = tx.objectStore('scenario')
    const config = scenarios.get('scenario-config')
    const claim = scenarios.get('visual-cart-claim')
    const carts = tx.objectStore('carts')
    const existing = carts.get(cartId(owner))
    const sessionRequest = auth ? tx.objectStore('sessions').get(auth.token) : undefined
    let reads = 0
    let failure: unknown
    const ready = () => {
      if (++reads !== (sessionRequest ? 4 : 3)) return
      try { assertSession(sessionRequest, owner.id, auth) } catch (error) { failure = error; tx.abort(); return }
      const name = config.result?.name
      if (claim.result || existing.result || (name !== 'visual-desktop' && name !== 'visual-mobile')) return
      carts.add(createVisualCart(owner, name))
      scenarios.add({ id: 'visual-cart-claim', owner: cartId(owner) })
    }
    config.onsuccess = ready
    claim.onsuccess = ready
    existing.onsuccess = ready
    if (sessionRequest) sessionRequest.onsuccess = ready
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Visual fixture claim failed'))
  })
}

export async function readStoredCart(database: IDBDatabase, owner: Owner): Promise<StoredCart> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('carts', 'readonly')
    const request = tx.objectStore('carts').get(cartId(owner))
    tx.oncomplete = () => resolve(request.result ?? empty(owner))
    tx.onabort = () => reject(tx.error ?? new Error('Cart read failed'))
  })
}

export async function setCartCoupon(database: IDBDatabase, owner: Owner, code: string | null, revision: number, auth?: Authorization): Promise<StoredCart> {
  if (!owner.id) throw new TypeError('Owner is required')
  const normalized = code === null ? null : code.trim().toUpperCase()
  if (normalized === 'EXPIRADO') throw new Error('COUPON_EXPIRED')
  if (normalized !== null && normalized !== 'KURIO10') throw new Error('COUPON_INVALID')
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['carts', 'ledger', 'scenario', 'sessions'], 'readwrite')
    const carts = tx.objectStore('carts')
    const cartRequest = carts.get(cartId(owner))
    const consumedRequest = owner.kind === 'visitor' ? tx.objectStore('ledger').get(`cart-merge:${owner.id}`) : undefined
    const couponRequest = tx.objectStore('scenario').get('coupon:KURIO10')
    const sessionRequest = auth ? tx.objectStore('sessions').get(auth.token) : undefined
    let pending = 2 + Number(Boolean(consumedRequest)) + Number(Boolean(sessionRequest))
    let result: StoredCart
    let failure: unknown
    const ready = () => {
      if (--pending !== 0) return
      try {
        assertSession(sessionRequest, owner.id, auth)
        if (consumedRequest?.result) throw new Error('VISITOR_ALREADY_CONSUMED')
        if (normalized === 'KURIO10' && couponRequest.result?.expired) throw new Error('COUPON_EXPIRED')
        const cart: StoredCart = cartRequest.result ?? empty(owner)
        if (cart.revision !== revision) throw new Error('REVISION_CONFLICT')
        result = cart.couponCode === normalized ? cart : { ...cart, couponCode: normalized, revision: cart.revision + 1 }
        if (result !== cart || !cartRequest.result) carts.put(result)
      } catch (error) { failure = error; tx.abort() }
    }
    cartRequest.onsuccess = ready
    couponRequest.onsuccess = ready
    if (consumedRequest) consumedRequest.onsuccess = ready
    if (sessionRequest) sessionRequest.onsuccess = ready
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Coupon mutation aborted'))
  })
}

/** The visitor is consumed only when its merged cart and ledger are committed. */
export async function mergeStoredCarts(database: IDBDatabase, userId: string, visitorId: string, mergeKey: string, auth?: Authorization): Promise<{ cart: StoredCart; adjustments: CartAdjustment[] }> {
  if (!userId || !visitorId || !mergeKey) throw new TypeError('User, visitor and merge key are required')
  const user: Owner = { kind: 'user', id: userId }
  const visitor: Owner = { kind: 'visitor', id: visitorId }
  const ledgerId = `cart-merge:${visitorId}`
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['carts', 'catalog', 'ledger', 'sessions'], 'readwrite')
    const carts = tx.objectStore('carts')
    const ledger = tx.objectStore('ledger')
    const userRequest = carts.get(cartId(user))
    const visitorRequest = carts.get(cartId(visitor))
    const catalogRequest = tx.objectStore('catalog').getAll()
    const priorRequest = ledger.get(ledgerId)
    const sessionRequest = auth ? tx.objectStore('sessions').get(auth.token) : undefined
    let reads = 0
    let result: { cart: StoredCart; adjustments: CartAdjustment[] }
    let failure: unknown
    const onRead = () => {
      if (++reads !== (sessionRequest ? 5 : 4)) return
      try {
        assertSession(sessionRequest, userId, auth)
        const prior = priorRequest.result as { userId: string; mergeKey: string; result: typeof result } | undefined
        if (prior) {
          if (prior.userId !== userId || prior.mergeKey !== mergeKey) throw new Error('VISITOR_ALREADY_CONSUMED')
          result = prior.result
          return
        }
        result = mergeLines(userRequest.result ?? empty(user), visitorRequest.result ?? empty(visitor), catalogRequest.result as NFT[], () => crypto.randomUUID())
        carts.put(result.cart)
        carts.delete(cartId(visitor))
        ledger.add({ id: ledgerId, userId, mergeKey, result })
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    userRequest.onsuccess = onRead
    visitorRequest.onsuccess = onRead
    catalogRequest.onsuccess = onRead
    priorRequest.onsuccess = onRead
    if (sessionRequest) sessionRequest.onsuccess = onRead
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Cart merge aborted'))
  })
}

/** Commit the mutation and its deduplication record in a single readwrite transaction. */
export async function mutateStoredCart(database: IDBDatabase, owner: Owner, mutation: Mutation, auth?: Authorization): Promise<StoredCart> {
  if (!owner.id) throw new TypeError('Owner is required')
  if (mutation.kind === 'add' && !mutation.mutationId) throw new TypeError('Mutation ID is required')
  const fingerprint = mutation.kind === 'add' ? JSON.stringify([mutation.nftId, mutation.editionId, mutation.quantity, mutation.revision]) : ''
  const ledgerId = mutation.kind === 'add' ? `cart-add:${cartId(owner)}:${mutation.mutationId}` : ''
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['carts', 'catalog', 'ledger', 'sessions'], 'readwrite')
    const carts = tx.objectStore('carts')
    const ledger = tx.objectStore('ledger')
    const cartRequest = carts.get(cartId(owner))
    const catalogRequest = tx.objectStore('catalog').getAll()
    const ledgerRequest = mutation.kind === 'add' ? ledger.get(ledgerId) : undefined
    const consumedRequest = owner.kind === 'visitor' ? ledger.get(`cart-merge:${owner.id}`) : undefined
    const sessionRequest = auth ? tx.objectStore('sessions').get(auth.token) : undefined
    let completedReads = 0
    const neededReads = 2 + Number(Boolean(ledgerRequest)) + Number(Boolean(consumedRequest)) + Number(Boolean(sessionRequest))
    let result: StoredCart
    let failure: unknown
    const onRead = () => {
      if (++completedReads !== neededReads) return
      try {
        assertSession(sessionRequest, owner.id, auth)
        if (consumedRequest?.result) throw new Error('VISITOR_ALREADY_CONSUMED')
        const old = cartRequest.result as StoredCart | undefined
        const cart = old ?? empty(owner)
        const prior = ledgerRequest?.result as { fingerprint: string; result: StoredCart } | undefined
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_CONFLICT')
          result = prior.result
          return
        }
        const catalog = catalogRequest.result as NFT[]
        if (mutation.kind === 'add') {
          result = addLine(cart, catalog, mutation, () => crypto.randomUUID())
          ledger.add({ id: ledgerId, fingerprint, result })
        } else if (mutation.kind === 'change') {
          result = changeLine(cart, catalog, mutation.lineId, mutation.quantity, mutation.revision)
        } else {
          result = removeLine(cart, mutation.lineId, mutation.revision)
        }
        if (result !== cart || !old) carts.put(result)
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    cartRequest.onsuccess = onRead
    catalogRequest.onsuccess = onRead
    if (ledgerRequest) ledgerRequest.onsuccess = onRead
    if (consumedRequest) consumedRequest.onsuccess = onRead
    if (sessionRequest) sessionRequest.onsuccess = onRead
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Cart mutation aborted'))
  })
}
