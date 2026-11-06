import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { EventGate } from '../src/realtime/event-gate.ts'

const event = (eventId: string, version: number, overrides = {}) => ({ eventId, version, type: 'order.updated', resourceId: 'order-1', occurredAt: '2026-07-29T12:00:00.000Z', ownerUserId: 'a', targetSessionId: 'session-a', payload: { orderId: 'order-1', status: 'pending' }, ...overrides })

test('event gate rejects duplicate, stale, mismatched session and terminal regression', () => {
  const gate = new EventGate('a', 'session-a')
  assert.equal(gate.accept(event('wrong-owner', 1, { ownerUserId: 'b' })), null)
  assert.equal(gate.accept(event('wrong-session', 1, { targetSessionId: 'session-b' })), null)
  assert.ok(gate.accept(event('first', 2)))
  assert.equal(gate.accept(event('first', 2)), null)
  assert.equal(gate.accept(event('older', 1)), null)
  assert.equal(gate.observeOrder('order-1', 1, 'pending'), false)
  assert.equal(gate.observeOrder('order-1', 3, 'confirmed'), true)
  assert.equal(gate.accept(event('late', 4)), null)
  assert.equal(gate.observeOrder('order-1', 4, 'declined'), false)
})

test('catalog watermark rejects stale list and resource results', () => {
  const gate = new EventGate(null, 'visitor')
  const nft = { eventId: 'nft-1', type: 'nft.updated', resourceId: 'nft', version: 2, catalogVersion: 9, occurredAt: '2026-07-29T12:00:00.000Z', payload: { nftId: 'nft', editions: [] } }
  assert.equal(gate.accept({ ...nft, eventId: 'bad', version: 100, catalogVersion: 100, payload: { nftId: 'nft', editions: [{ id: 'one-of-ten', unitPrice: '-1', available: -1, version: 1, label: '1/10' }] } }), null)
  assert.equal(gate.catalogVersion, 0)
  assert.ok(gate.accept(nft))
  assert.equal(gate.catalogVersion, 9)
  assert.equal(gate.observeNft('nft', 1, 8), false)
  assert.equal(gate.observeNft('nft', 2, 9), true)
  assert.equal(gate.accept({ ...nft, eventId: 'older-event', version: 3, catalogVersion: 8 }), null)
})
