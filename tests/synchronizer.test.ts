import { strict as assert } from 'node:assert'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import type { Socket } from 'socket.io-client'
import { RealtimeSynchronizer } from '../src/realtime/synchronizer.ts'

class FakeSocket extends EventEmitter {
  connected = false
  connect() { this.connected = true; this.emit('connect'); return this }
  disconnect() { this.connected = false; this.emit('disconnect'); return this }
}

test('reconciliation gates readiness on connection and listeners are removed on stop', async () => {
  const socket = new FakeSocket()
  const states: boolean[] = []
  let release: (() => void) | undefined
  let nonce = ''
  let requestId = ''
  socket.on('session.bind', (data) => { nonce = data.nonce })
  socket.on('resources.subscribe', (data) => { requestId = data.requestId })
  const sync = new RealtimeSynchronizer(socket as unknown as Socket, { token: 'token', ownerId: 'a' }, {
    reconcile: () => new Promise<void>((resolve) => { release = resolve }),
    refresh: async () => {}, onReady: (value) => states.push(value), onRejected: () => {}, onError: (error) => { throw error },
  })
  sync.start()
  socket.emit('session.ready', { nonce, sessionId: 'session-a' })
  socket.emit('resources.subscribed', { requestId, catalog: false, nftIds: [], orderIds: [] })
  assert.equal(states.at(-1), false)
  release!()
  await Promise.resolve()
  assert.equal(states.at(-1), true)
  socket.emit('disconnect')
  assert.equal(states.at(-1), false)
  sync.stop()
  assert.equal(socket.listenerCount('nft.updated'), 0)
  assert.equal(socket.listenerCount('order.updated'), 0)
})

test('an event during reconnect cannot enable checkout before all REST reconciliation finishes', async () => {
  const socket = new FakeSocket()
  const states: boolean[] = []
  let release!: () => void
  let nonce = ''
  let requestId = ''
  socket.on('session.bind', (data) => { nonce = data.nonce })
  socket.on('resources.subscribe', (data) => { requestId = data.requestId })
  const sync = new RealtimeSynchronizer(socket as unknown as Socket, { token: 'token', ownerId: 'a' }, {
    reconcile: () => new Promise<void>((resolve) => { release = resolve }),
    refresh: async () => {}, onReady: (value) => states.push(value), onRejected: () => {}, onError: (error) => { throw error },
  })
  sync.start()
  socket.emit('session.ready', { nonce, sessionId: 'session-a' })
  socket.emit('resources.subscribed', { requestId, catalog: false, nftIds: [], orderIds: [] })
  socket.emit('nft.updated', { eventId: 'event', type: 'nft.updated', resourceId: 'nft', version: 1, catalogVersion: 1, occurredAt: new Date().toISOString(), payload: { nftId: 'nft', editions: [] } })
  await Promise.resolve()
  assert.equal(states.at(-1), false)
  release()
  await Promise.resolve()
  assert.equal(states.at(-1), true)
  sync.stop()
})

test('reconnect keeps session watermarks and ignores stale bind acknowledgements', async () => {
  const socket = new FakeSocket()
  let nonce = ''
  socket.on('session.bind', (data) => { nonce = data.nonce })
  const sync = new RealtimeSynchronizer(socket as unknown as Socket, { token: 'token', ownerId: 'a' }, {
    reconcile: async () => {}, refresh: async () => {}, onReady: () => {}, onRejected: () => {}, onError: (error) => { throw error },
  })
  sync.start()
  const oldNonce = nonce
  socket.emit('session.ready', { nonce, sessionId: 'session-a' })
  const gate = sync.currentGate!
  assert.equal(gate.observeCatalog(5), true)
  socket.disconnect()
  assert.equal(sync.currentGate, null)
  socket.connect()
  assert.notEqual(nonce, oldNonce)
  socket.emit('session.ready', { nonce: oldNonce, sessionId: 'session-a' })
  assert.equal(sync.currentGate, null)
  socket.emit('nft.updated', { eventId: 'unbound', type: 'nft.updated', resourceId: 'nft', version: 9, catalogVersion: 9, occurredAt: new Date().toISOString(), payload: { nftId: 'nft', editions: [] } })
  socket.emit('session.ready', { nonce, sessionId: 'session-a' })
  assert.equal(sync.currentGate, gate)
  assert.equal(sync.currentGate?.catalogVersion, 5)
  sync.stop()
})

test('stale subscription acknowledgements cannot reconcile or enable an outdated resource set', async () => {
  const socket = new FakeSocket()
  const requests: Array<{ requestId: string; catalog: boolean; nftIds: string[]; orderIds: string[] }> = []
  const states: boolean[] = []
  const errors: unknown[] = []
  let reconciliations = 0
  let nonce = ''
  socket.on('session.bind', (data) => { nonce = data.nonce })
  socket.on('resources.subscribe', (data) => requests.push(data))
  const sync = new RealtimeSynchronizer(socket as unknown as Socket, { token: 'token', ownerId: 'a' }, {
    reconcile: async () => { reconciliations++ }, refresh: async () => {},
    onReady: (value) => states.push(value), onRejected: () => {}, onError: (error) => errors.push(error),
  })
  sync.start()
  socket.emit('session.ready', { nonce, sessionId: 'session-a' })
  sync.setResources({ catalog: false, nftIds: ['nft'], orderIds: [] })
  socket.emit('resources.subscribed', requests[0])
  await Promise.resolve()
  assert.equal(reconciliations, 0)
  assert.equal(states.at(-1), false)
  assert.equal(errors.length, 0)
  socket.emit('resources.subscribed', requests[1])
  await Promise.resolve()
  assert.equal(reconciliations, 1)
  assert.equal(states.at(-1), true)
  sync.setResources({ catalog: false, nftIds: ['nft'], orderIds: ['private'] })
  socket.emit('resources.subscribed', { ...requests[2], orderIds: [] })
  assert.equal(states.at(-1), false)
  assert.equal(errors.length, 1)
  sync.stop()
})

test('a stopped session ignores delayed reconciliation and old events after a new session starts', async () => {
  const oldSocket = new FakeSocket()
  const newSocket = new FakeSocket()
  let oldNonce = ''
  let oldRequest = ''
  let newNonce = ''
  let newRequest = ''
  let releaseOld!: () => void
  const oldStates: boolean[] = []
  const newStates: boolean[] = []
  let oldRefreshes = 0
  let newRefreshes = 0
  oldSocket.on('session.bind', (data) => { oldNonce = data.nonce })
  oldSocket.on('resources.subscribe', (data) => { oldRequest = data.requestId })
  newSocket.on('session.bind', (data) => { newNonce = data.nonce })
  newSocket.on('resources.subscribe', (data) => { newRequest = data.requestId })
  const oldSync = new RealtimeSynchronizer(oldSocket as unknown as Socket, { token: 'a', ownerId: 'a' }, {
    reconcile: () => new Promise<void>((resolve) => { releaseOld = resolve }),
    refresh: async () => { oldRefreshes++ }, onReady: (ready) => oldStates.push(ready), onRejected: () => {}, onError: (error) => { throw error },
  })
  const newSync = new RealtimeSynchronizer(newSocket as unknown as Socket, { token: 'b', ownerId: 'b' }, {
    reconcile: async () => {}, refresh: async () => { newRefreshes++ },
    onReady: (ready) => newStates.push(ready), onRejected: () => {}, onError: (error) => { throw error },
  })
  oldSync.start()
  oldSocket.emit('session.ready', { nonce: oldNonce, sessionId: 'session-a' })
  oldSocket.emit('resources.subscribed', { requestId: oldRequest, catalog: false, nftIds: [], orderIds: [] })
  oldSync.stop()
  newSync.start()
  newSocket.emit('session.ready', { nonce: newNonce, sessionId: 'session-b' })
  newSocket.emit('resources.subscribed', { requestId: newRequest, catalog: false, nftIds: [], orderIds: [] })
  await Promise.resolve()
  assert.equal(newStates.at(-1), true)
  const oldEvent = { eventId: 'late-a', type: 'order.updated', resourceId: 'order-a', version: 1, occurredAt: new Date().toISOString(), ownerUserId: 'a', targetSessionId: 'session-a', payload: { orderId: 'order-a', status: 'confirmed' } }
  oldSocket.emit('order.updated', oldEvent)
  newSocket.emit('order.updated', oldEvent)
  releaseOld()
  await Promise.resolve()
  assert.equal(oldStates.at(-1), false)
  assert.equal(newStates.at(-1), true)
  assert.equal(oldRefreshes, 0)
  assert.equal(newRefreshes, 0)
  for (const name of ['connect', 'disconnect', 'session.ready', 'session.rejected', 'resources.subscribed', 'nft.updated', 'order.updated']) assert.equal(oldSocket.listenerCount(name), 0)
  newSync.stop()
})
