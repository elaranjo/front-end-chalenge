import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { openMockDatabase, resetMockDatabase } from '../src/mocks/database.ts'
import { createCatalogSeed } from '../src/mocks/catalog-seed.ts'
import { mergeStoredCarts, mutateStoredCart, readStoredCart } from '../src/mocks/cart-repository.ts'

test('concurrent identical cart additions commit exactly once and remain isolated', async () => {
  const db = await openMockDatabase('test-cart-repository')
  await resetMockDatabase(db, { catalog: createCatalogSeed() })
  const owner = { kind: 'visitor' as const, id: 'visitor-a' }
  const mutation = { kind: 'add' as const, mutationId: 'attempt-1', nftId: 'emerald-ape-042', editionId: 'one-of-ten' as const, quantity: 2, revision: 0 }
  try {
    const [first, replay] = await Promise.all([mutateStoredCart(db, owner, mutation), mutateStoredCart(db, owner, mutation)])
    assert.deepEqual(first, replay)
    assert.equal((await readStoredCart(db, owner)).lines[0].quantity, 2)
    assert.equal((await readStoredCart(db, { kind: 'visitor', id: 'visitor-b' })).lines.length, 0)
    await assert.rejects(mutateStoredCart(db, owner, { ...mutation, quantity: 3 }), /IDEMPOTENCY_CONFLICT/)
    assert.equal((await readStoredCart(db, owner)).revision, 1)
  } finally { db.close() }
})

test('merge is atomic, idempotent, and a consumed visitor cannot be merged into another account', async () => {
  const db = await openMockDatabase('test-cart-merge')
  await resetMockDatabase(db, { catalog: createCatalogSeed() })
  const visitor = { kind: 'visitor' as const, id: 'visitor-merge' }
  const user = { kind: 'user' as const, id: 'user-a' }
  const input = { kind: 'add' as const, nftId: 'emerald-ape-042', editionId: 'one-of-ten' as const }
  try {
    await mutateStoredCart(db, visitor, { ...input, quantity: 5, revision: 0, mutationId: 'visitor-add' })
    await mutateStoredCart(db, user, { ...input, quantity: 8, revision: 0, mutationId: 'user-add' })
    const [first, retry] = await Promise.all([mergeStoredCarts(db, 'user-a', visitor.id, 'merge-1'), mergeStoredCarts(db, 'user-a', visitor.id, 'merge-1')])
    assert.deepEqual(first, retry)
    assert.equal(first.cart.lines[0].quantity, 10)
    assert.equal(first.adjustments[0].accepted, 2)
    assert.equal((await readStoredCart(db, visitor)).lines.length, 0)
    assert.equal((await readStoredCart(db, user)).lines[0].quantity, 10)
    await assert.rejects(mergeStoredCarts(db, 'user-b', visitor.id, 'merge-1'), /VISITOR_ALREADY_CONSUMED/)
    await assert.rejects(mergeStoredCarts(db, 'user-a', visitor.id, 'other-key'), /VISITOR_ALREADY_CONSUMED/)
    await assert.rejects(mutateStoredCart(db, visitor, { ...input, quantity: 1, revision: 0, mutationId: 'after-merge' }), /VISITOR_ALREADY_CONSUMED/)
  } finally { db.close() }
})
