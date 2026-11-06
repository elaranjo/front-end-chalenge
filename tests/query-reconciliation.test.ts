import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { QueryClient } from '@tanstack/react-query'
import { createQueryReconciliation } from '../src/realtime/query-reconciliation.ts'

test('reconciliation invalidates active resources without touching another owner', async () => {
  const client = new QueryClient()
  client.setQueryData(['catalog', {}], 'catalog')
  client.setQueryData(['order', 'one', 'a'], 'a')
  client.setQueryData(['order', 'two', 'b'], 'b')
  const orderA = client.getQueryCache().find({ queryKey: ['order', 'one', 'a'] })!
  const orderB = client.getQueryCache().find({ queryKey: ['order', 'two', 'b'] })!
  orderA.setOptions({ queryKey: ['order', 'one', 'a'], meta: { private: true, ownerId: 'a' } })
  orderB.setOptions({ queryKey: ['order', 'two', 'b'], meta: { private: true, ownerId: 'b' } })
  const reconciliation = createQueryReconciliation(client, 'a')
  await reconciliation.reconcile({ catalog: true, nftIds: [], orderIds: ['one', 'two'] })
  assert.equal(orderA.state.isInvalidated, true)
  assert.equal(orderB.state.isInvalidated, false)
  assert.equal(client.getQueryState(['catalog', {}])?.isInvalidated, true)
})

test('NFT updates invalidate only the current owner cart and quote', async () => {
  const client = new QueryClient()
  for (const [resource, ownerId] of [['cart', 'a'], ['quote', 'a'], ['favorites', 'a'], ['cart', 'b'], ['quote', 'b'], ['favorites', 'b']] as const) {
    const key = [resource, ownerId]
    client.setQueryData(key, 'data')
    client.getQueryCache().find({ queryKey: key })!.setOptions({ queryKey: key, meta: { private: true, ownerId } })
  }
  await createQueryReconciliation(client, 'a').refresh({
    type: 'nft.updated', eventId: 'e', resourceId: 'nft', version: 1, catalogVersion: 1,
    occurredAt: new Date().toISOString(), payload: { nftId: 'nft', editions: [] },
  })
  for (const resource of ['cart', 'quote', 'favorites']) {
    assert.equal(client.getQueryState([resource, 'a'])?.isInvalidated, true)
    assert.equal(client.getQueryState([resource, 'b'])?.isInvalidated, false)
  }
})

test('reconnection invalidates all current private account resources and leaves other owners untouched', async () => {
  const client = new QueryClient()
  for (const resource of ['profile', 'wallets', 'favorites']) {
    for (const ownerId of ['a', 'b']) {
      const key = [resource, ownerId, 1]
      client.setQueryData(key, 'data')
      client.getQueryCache().find({ queryKey: key })!.setOptions({ queryKey: key, meta: { private: true, ownerId } })
    }
  }
  await createQueryReconciliation(client, 'a').reconcile({ catalog: false, nftIds: [], orderIds: [] })
  for (const resource of ['profile', 'wallets', 'favorites']) {
    assert.equal(client.getQueryState([resource, 'a', 1])?.isInvalidated, true)
    assert.equal(client.getQueryState([resource, 'b', 1])?.isInvalidated, false)
  }
})
