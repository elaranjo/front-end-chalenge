import type { Socket } from 'socket.io-client'
import { EventGate, type RealtimeEvent } from './event-gate.ts'

export type RealtimeResources = { catalog: boolean; nftIds: string[]; orderIds: string[] }
export type RealtimeIdentity = { token: string; ownerId: string } | { visitorId: string; ownerId: null }
type Dependencies = {
  /** Must fetch every active resource over REST and reject on failure. */
  reconcile: (resources: RealtimeResources, gate: EventGate) => Promise<void>
  /** Must invalidate/refetch resources; order confirmation still comes from REST. */
  refresh: (event: RealtimeEvent, gate: EventGate) => Promise<void>
  onReady: (ready: boolean) => void
  onRejected: () => void
  onError: (error: unknown) => void
}

export class RealtimeSynchronizer {
  private readonly socket: Socket
  private readonly identity: RealtimeIdentity
  private readonly deps: Dependencies
  private nonce = crypto.randomUUID()
  private epoch = 0
  private pending = 0
  private reconciled = false
  private failed = false
  private stopped = true
  private gate: EventGate | null = null
  private boundSessionId: string | null = null
  private bound = false
  private subscriptionId: string | null = null
  private resources: RealtimeResources = { catalog: false, nftIds: [], orderIds: [] }

  constructor(socket: Socket, identity: RealtimeIdentity, deps: Dependencies) {
    this.socket = socket
    this.identity = identity
    this.deps = deps
  }

  get currentGate(): EventGate | null { return this.bound ? this.gate : null }

  private invalidate() {
    ++this.epoch
    this.pending = 0
    this.reconciled = false
    this.failed = false
    this.subscriptionId = null
    this.deps.onReady(false)
  }

  private run(work: Promise<void>, epoch: number, gate: EventGate, reconciliation = false) {
    ++this.pending
    this.deps.onReady(false)
    void work.then(() => {
      if (this.stopped || this.epoch !== epoch || this.gate !== gate) return
      if (reconciliation) this.reconciled = true
      --this.pending
      if (this.reconciled && !this.failed && this.pending === 0 && this.socket.connected) this.deps.onReady(true)
    }).catch((error: unknown) => {
      if (this.stopped || this.epoch !== epoch || this.gate !== gate) return
      --this.pending
      this.failed = true
      this.deps.onError(error)
    })
  }

  private onConnect = () => {
    this.invalidate()
    this.bound = false
    this.nonce = crypto.randomUUID()
    const payload = 'token' in this.identity ? { token: this.identity.token, nonce: this.nonce } : { visitorId: this.identity.visitorId, nonce: this.nonce }
    this.socket.emit('session.bind', payload)
  }

  private onDisconnect = () => {
    this.invalidate()
    this.bound = false
  }

  private onSessionReady = (value: unknown) => {
    if (this.stopped || !this.socket.connected || !value || typeof value !== 'object' || !('nonce' in value) || value.nonce !== this.nonce || !('sessionId' in value) || typeof value.sessionId !== 'string') return
    if (!this.gate || this.boundSessionId !== value.sessionId) this.gate = new EventGate(this.identity.ownerId, value.sessionId)
    this.boundSessionId = value.sessionId
    this.bound = true
    this.subscribeResources()
  }

  private subscribeResources() {
    this.subscriptionId = crypto.randomUUID()
    this.socket.emit('resources.subscribe', { ...this.resources, requestId: this.subscriptionId })
  }

  private onSubscribed = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('requestId' in value) || value.requestId !== this.subscriptionId || !('catalog' in value) || !('nftIds' in value) || !('orderIds' in value)) return
    if (value.catalog !== this.resources.catalog || JSON.stringify(value.nftIds) !== JSON.stringify(this.resources.nftIds) || JSON.stringify(value.orderIds) !== JSON.stringify(this.resources.orderIds)) {
      this.deps.onError(new Error('Subscription was not authorized'))
      return
    }
    const gate = this.gate
    const epoch = this.epoch
    if (!gate || !this.bound || this.stopped) return
    this.run(this.deps.reconcile(this.resources, gate), epoch, gate, true)
  }

  private onEvent = (value: unknown) => {
    const gate = this.gate
    if (!gate || !this.bound || this.stopped) return
    const event = gate.accept(value)
    if (!event) return
    this.run(this.deps.refresh(event, gate), this.epoch, gate)
  }

  private onRejected = () => { this.onDisconnect(); this.deps.onRejected() }

  setResources(resources: RealtimeResources) {
    this.resources = { catalog: resources.catalog, nftIds: [...new Set(resources.nftIds)], orderIds: [...new Set(resources.orderIds)] }
    if (!this.stopped && this.bound && this.gate && this.socket.connected) {
      this.invalidate()
      this.subscribeResources()
    }
  }

  start() {
    if (!this.stopped) return
    this.stopped = false
    this.socket.on('connect', this.onConnect)
    this.socket.on('disconnect', this.onDisconnect)
    this.socket.on('session.ready', this.onSessionReady)
    this.socket.on('session.rejected', this.onRejected)
    this.socket.on('resources.subscribed', this.onSubscribed)
    this.socket.on('nft.updated', this.onEvent)
    this.socket.on('order.updated', this.onEvent)
    if (this.socket.connected) this.onConnect()
    else this.socket.connect()
  }

  stop() {
    if (this.stopped) return
    this.stopped = true
    ++this.epoch
    this.gate = null
    this.boundSessionId = null
    this.bound = false
    this.deps.onReady(false)
    this.socket.off('connect', this.onConnect)
    this.socket.off('disconnect', this.onDisconnect)
    this.socket.off('session.ready', this.onSessionReady)
    this.socket.off('session.rejected', this.onRejected)
    this.socket.off('resources.subscribed', this.onSubscribed)
    this.socket.off('nft.updated', this.onEvent)
    this.socket.off('order.updated', this.onEvent)
    this.socket.disconnect()
  }
}
