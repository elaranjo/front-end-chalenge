import type { NFT, Quote, Wallet } from '../shared/contracts.ts'
import { calculateQuote, formatEth, lineTotal } from '../shared/money.ts'
import type { StoredCart } from './cart-domain.ts'
import { assertSession, type Authorization } from './cart-repository.ts'

type Owner = { kind: 'visitor' | 'user'; id: string }

/** Snapshot the cart, catalog and quote together to prevent mixed revisions. */
export type CheckoutQuoteOptions = { walletId: string; network: Wallet['network']; provider: Wallet['type']; cartRevision: number }
export async function readCartView(database: IDBDatabase, owner: Owner, now = Date.now(), checkout?: CheckoutQuoteOptions, auth?: Authorization) {
  return new Promise<StoredCart & { catalogVersion: number; lines: Array<StoredCart['lines'][number] & { nft: NFT; unitPrice: string; available: number }>; quote: Quote | null; adjustments: string[] }>((resolve, reject) => {
    const tx = database.transaction(['carts', 'catalog', 'scenario', 'quotes', 'wallets', 'sessions'], 'readwrite')
    const cartRequest = tx.objectStore('carts').get(`${owner.kind}:${owner.id}`)
    const catalogRequest = tx.objectStore('catalog').getAll()
    const metaRequest = tx.objectStore('scenario').get('catalog-meta')
    const feeRequest = tx.objectStore('scenario').get('network-fee')
    const couponRequest = tx.objectStore('scenario').get('coupon:KURIO10')
    const walletRequest = checkout ? tx.objectStore('wallets').get(checkout.walletId) : undefined
    const sessionRequest = auth ? tx.objectStore('sessions').get(auth.token) : undefined
    let reads = 0
    let result: StoredCart & { catalogVersion: number; lines: Array<StoredCart['lines'][number] & { nft: NFT; unitPrice: string; available: number }>; quote: Quote | null; adjustments: string[] }
    let failure: unknown
    const ready = () => {
      if (++reads !== 5 + Number(Boolean(walletRequest)) + Number(Boolean(sessionRequest))) return
      try {
        assertSession(sessionRequest, owner.id, auth)
        const cart: StoredCart = cartRequest.result ?? { id: `${owner.kind}:${owner.id}`, ownerKind: owner.kind, revision: 0, lines: [], couponCode: null }
        if (checkout) {
          if (owner.kind !== 'user' || !walletRequest?.result) throw new Error('WALLET_NOT_FOUND')
          if (walletRequest.result.ownerUserId !== owner.id) throw new Error('FORBIDDEN')
          if (walletRequest.result.network !== checkout.network) throw new Error('NETWORK_MISMATCH')
          if (cart.revision !== checkout.cartRevision) throw new Error('REVISION_CONFLICT')
          if (!cart.lines.length) throw new Error('EMPTY_CART')
        }
        const catalog = catalogRequest.result as NFT[]
        const catalogVersion = metaRequest.result?.catalogVersion
        if (!Number.isSafeInteger(catalogVersion)) throw new Error('Catalog unavailable')
        const lines = cart.lines.map((line) => {
          const nft = catalog.find((entry) => entry.id === line.nftId)
          const edition = nft?.editions.find((entry) => entry.id === line.editionId)
          if (!nft || !edition) throw new Error('Cart item not found in catalog')
          if (checkout && line.quantity > edition.available) throw new Error('EDITION_UNAVAILABLE')
          return { ...line, nft, unitPrice: edition.unitPrice, available: edition.available }
        })
        const quoteLines = lines.map((line) => {
          const edition = line.nft.editions.find((entry) => entry.id === line.editionId)!
          return { lineId: line.lineId, nftId: line.nftId, editionId: line.editionId, nftVersion: line.nft.version, editionVersion: edition.version, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: formatEth(lineTotal(line.unitPrice, line.quantity)) }
        })
        if (cart.couponCode === 'KURIO10' && couponRequest.result?.expired) {
          if (checkout) throw new Error('COUPON_EXPIRED')
          result = { ...cart, catalogVersion, lines, quote: null, adjustments: ['COUPON_EXPIRED'] }
          return
        }
        const coupon = cart.couponCode === 'KURIO10' ? { code: cart.couponCode, version: couponRequest.result?.version ?? 1 } : null
        const fee = feeRequest.result?.amount ?? '0.016'
        const feeVersion = feeRequest.result?.version ?? 0
        const totals = calculateQuote(lines, fee, coupon ? 10 : 0)
        const network = checkout?.network ?? 'ethereum'
        const walletVersion = walletRequest?.result?.version
        const fingerprint = JSON.stringify({ cartId: cart.id, cartRevision: cart.revision, catalogVersion, lines: quoteLines, coupon, ...totals, network, walletId: checkout?.walletId, walletVersion, provider: checkout?.provider })
        const quote: Quote = { id: crypto.randomUUID(), cartId: cart.id, cartRevision: cart.revision, catalogVersion, lines: quoteLines, coupon, ...totals, network, expiresAt: new Date(now + 60_000).toISOString(), fingerprint }
        tx.objectStore('quotes').add({ ...quote, feeVersion, ...(checkout ? { ownerUserId: owner.id, walletId: checkout.walletId, walletVersion, provider: checkout.provider } : {}) })
        result = { ...cart, catalogVersion, lines, quote, adjustments: [] }
      } catch (error) { failure = error; tx.abort() }
    }
    cartRequest.onsuccess = ready
    catalogRequest.onsuccess = ready
    metaRequest.onsuccess = ready
    feeRequest.onsuccess = ready
    couponRequest.onsuccess = ready
    if (walletRequest) walletRequest.onsuccess = ready
    if (sessionRequest) sessionRequest.onsuccess = ready
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Cart view failed'))
  })
}
