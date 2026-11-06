import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { addLine, changeLine, consumePurchased, mergeLines, removeLine, CartConflict, type StoredCart } from '../src/mocks/cart-domain.ts'
import { createCatalogSeed } from '../src/mocks/catalog-seed.ts'

const empty = (id: string, ownerKind: StoredCart['ownerKind']): StoredCart => ({ id, ownerKind, revision: 0, lines: [], couponCode: null })
const catalog = createCatalogSeed()
const input = { nftId: 'emerald-ape-042', editionId: 'one-of-ten' as const, quantity: 2, revision: 0 }

test('cart mutations enforce revision, stock and line identity without changing the original', () => {
  const original = empty('visitor', 'visitor')
  const one = addLine(original, catalog, input, () => 'line-1')
  assert.equal(original.lines.length, 0)
  assert.equal(one.lines[0].quantity, 2)
  assert.throws(() => addLine(one, catalog, input, () => 'unused'), (error: unknown) => error instanceof CartConflict && error.code === 'REVISION_CONFLICT')
  assert.throws(() => changeLine(one, catalog, 'line-1', 11, 1), (error: unknown) => error instanceof CartConflict && error.code === 'EDITION_UNAVAILABLE')
  assert.throws(() => changeLine(one, catalog, 'line-1', 1.5, 1), RangeError)
  const removed = removeLine(one, 'line-1', 1)
  assert.equal(changeLine(one, catalog, 'line-1', 2, 0), one)
  assert.equal(removeLine(removed, 'line-1', 1), removed)
  const recreated = addLine(removed, catalog, { ...input, revision: 2 }, () => 'line-2')
  assert.equal(recreated.lines[0].lineId, 'line-2')
  assert.equal(removeLine(recreated, 'line-1', 1), recreated)
  assert.equal(recreated.lines[0].quantity, 2)
})

test('visitor merge caps stock and reports every rejected unit', () => {
  const user = addLine(empty('user', 'user'), catalog, { ...input, quantity: 8 }, () => 'user-line')
  const visitor = addLine(empty('visitor', 'visitor'), catalog, { ...input, quantity: 5 }, () => 'visitor-line')
  const result = mergeLines(user, visitor, catalog, () => 'new-line')
  assert.equal(result.cart.lines[0].quantity, 10)
  assert.equal(result.cart.lines[0].lineId, 'user-line')
  assert.deepEqual(result.adjustments, [{ nftId: input.nftId, editionId: input.editionId, requested: 5, accepted: 2 }])
  assert.equal(user.lines[0].quantity, 8)
  assert.equal(visitor.lines[0].quantity, 5)
})

test('confirmation consumes only captured line quantities, preserving later additions and recreated lines', () => {
  const cart: StoredCart = {
    ...empty('user', 'user'), revision: 7,
    lines: [
      { lineId: 'captured', nftId: input.nftId, editionId: input.editionId, quantity: 5 },
      { lineId: 'recreated', nftId: input.nftId, editionId: 'one-of-fifty', quantity: 4 },
    ],
  }
  const after = consumePurchased(cart, [{ lineId: 'captured', quantity: 2 }, { lineId: 'removed-before-confirmation', quantity: 1 }])
  assert.equal(after.revision, 8)
  assert.deepEqual(after.lines.map(({ lineId, quantity }) => [lineId, quantity]), [['captured', 3], ['recreated', 4]])
  assert.equal(cart.lines[0].quantity, 5)
  assert.throws(() => consumePurchased(cart, [{ lineId: 'captured', quantity: 2 }, { lineId: 'captured', quantity: 2 }]), TypeError)
  assert.throws(() => consumePurchased(cart, [{ lineId: 'captured', quantity: 0 }]), RangeError)
})
