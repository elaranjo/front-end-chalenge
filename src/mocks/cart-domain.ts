import type { Edition, NFT } from '../shared/contracts.ts'

export type CartLine = { lineId: string; nftId: string; editionId: Edition['id']; quantity: number }
export type StoredCart = { id: string; ownerKind: 'visitor' | 'user'; revision: number; lines: CartLine[]; couponCode: string | null }
export type CartAdjustment = { nftId: string; editionId: Edition['id']; requested: number; accepted: number }

export class CartConflict extends Error {
  readonly code: 'REVISION_CONFLICT' | 'EDITION_UNAVAILABLE' | 'LINE_NOT_FOUND'
  constructor(code: 'REVISION_CONFLICT' | 'EDITION_UNAVAILABLE' | 'LINE_NOT_FOUND') {
    super(code)
    this.code = code
  }
}

function checkQuantity(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new RangeError('Quantity must be a positive integer')
}

function findEdition(catalog: readonly NFT[], nftId: string, editionId: Edition['id']) {
  const edition = catalog.find((nft) => nft.id === nftId)?.editions.find((item) => item.id === editionId)
  if (!edition) throw new CartConflict('EDITION_UNAVAILABLE')
  return edition
}

function checkRevision(cart: StoredCart, revision: number) {
  if (cart.revision !== revision) throw new CartConflict('REVISION_CONFLICT')
}

export function addLine(cart: StoredCart, catalog: readonly NFT[], input: { nftId: string; editionId: Edition['id']; quantity: number; revision: number }, newLineId: () => string): StoredCart {
  checkRevision(cart, input.revision)
  checkQuantity(input.quantity)
  const edition = findEdition(catalog, input.nftId, input.editionId)
  const existing = cart.lines.find((line) => line.nftId === input.nftId && line.editionId === input.editionId)
  const quantity = (existing?.quantity ?? 0) + input.quantity
  if (!Number.isSafeInteger(quantity) || quantity > edition.available) throw new CartConflict('EDITION_UNAVAILABLE')
  const lines = existing
    ? cart.lines.map((line) => line.lineId === existing.lineId ? { ...line, quantity } : line)
    : [...cart.lines, { lineId: newLineId(), nftId: input.nftId, editionId: input.editionId, quantity }]
  return { ...cart, lines, revision: cart.revision + 1 }
}

export function changeLine(cart: StoredCart, catalog: readonly NFT[], lineId: string, quantity: number, revision: number): StoredCart {
  checkQuantity(quantity)
  const line = cart.lines.find((entry) => entry.lineId === lineId)
  if (line?.quantity === quantity) return cart
  checkRevision(cart, revision)
  if (!line) throw new CartConflict('LINE_NOT_FOUND')
  if (quantity > findEdition(catalog, line.nftId, line.editionId).available) throw new CartConflict('EDITION_UNAVAILABLE')
  return { ...cart, lines: cart.lines.map((entry) => entry.lineId === lineId ? { ...entry, quantity } : entry), revision: cart.revision + 1 }
}

export function removeLine(cart: StoredCart, lineId: string, revision: number): StoredCart {
  if (!cart.lines.some((line) => line.lineId === lineId)) return cart
  checkRevision(cart, revision)
  return { ...cart, lines: cart.lines.filter((line) => line.lineId !== lineId), revision: cart.revision + 1 }
}

/** Merge is a pure calculation; the caller commits both carts and the merge ledger atomically. */
export function mergeLines(user: StoredCart, visitor: StoredCart, catalog: readonly NFT[], newLineId: () => string) {
  let next = user
  const adjustments: CartAdjustment[] = []
  for (const line of visitor.lines) {
    const existing = next.lines.find((entry) => entry.nftId === line.nftId && entry.editionId === line.editionId)
    const available = catalog.find((item) => item.id === line.nftId)?.editions.find((item) => item.id === line.editionId)?.available ?? 0
    const accepted = Math.max(0, Math.min(line.quantity, available - (existing?.quantity ?? 0)))
    if (accepted < line.quantity) adjustments.push({ nftId: line.nftId, editionId: line.editionId, requested: line.quantity, accepted })
    if (accepted > 0) next = addLine(next, catalog, { nftId: line.nftId, editionId: line.editionId, quantity: accepted, revision: next.revision }, newLineId)
  }
  return { cart: next, adjustments }
}

/** Only lines captured by the order may be consumed; recreated lines have different IDs. */
export function consumePurchased(cart: StoredCart, purchased: readonly { lineId: string; quantity: number }[]): StoredCart {
  const quantities = new Map<string, number>()
  for (const line of purchased) {
    if (!line.lineId || quantities.has(line.lineId)) throw new TypeError('Order lines must have unique IDs')
    checkQuantity(line.quantity)
    quantities.set(line.lineId, line.quantity)
  }
  let changed = false
  const lines = cart.lines.flatMap((line) => {
    const quantity = quantities.get(line.lineId)
    if (quantity === undefined) return [line]
    changed = true
    const remaining = Math.max(0, line.quantity - quantity)
    return remaining ? [{ ...line, quantity: remaining }] : []
  })
  return changed ? { ...cart, lines, revision: cart.revision + 1 } : cart
}
