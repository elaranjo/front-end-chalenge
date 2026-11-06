import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import type { Session, Cart } from '../shared/contracts.ts'
import type { SessionManager } from '../shared/session.ts'
import { visitorId } from '../shared/visitor-cart.ts'
import { createQueryReconciliation } from './query-reconciliation.ts'
import { RealtimeSynchronizer, type RealtimeResources } from './synchronizer.ts'

/** Owns one socket per session generation and subscriptions for active queries. */
export class RealtimeRuntime {
  private sync: RealtimeSynchronizer | null = null
  private stopSession: (() => void) | null = null
  private stopQueries: (() => void) | null = null
  private signature = ''
  private queued = false
  private generation = 0
  private sessionGeneration = -1
  private ready = false
  private readinessRevision = 0
  private listeners = new Set<(ready: boolean) => void>()
  private readonly sessions: SessionManager
  private readonly queries: QueryClient
  private readonly storage: Storage
  private readonly socketFactory: () => Socket
  private readonly onError: (error: unknown) => void
  constructor(sessions: SessionManager, queries: QueryClient, storage: Storage, socketFactory: () => Socket, onError: (error: unknown) => void) {
    this.sessions = sessions; this.queries = queries; this.storage = storage; this.socketFactory = socketFactory; this.onError = onError
  }
  get revision() { return this.readinessRevision }
  get isReady() { return this.ready && this.sessionGeneration === this.sessions.sessionGeneration }
  get currentGate() { return this.sessionGeneration === this.sessions.sessionGeneration ? this.sync?.currentGate ?? null : null }
  subscribe(listener: (ready: boolean) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private setReady(value: boolean) {
    if (value === this.ready) return
    this.ready = value
    if (!value) this.readinessRevision += 1
    for (const listener of this.listeners) listener(value)
  }
  private resources(ownerId: string | null): RealtimeResources {
    const nftIds = new Set<string>()
    const orderIds = new Set<string>()
    let catalog = false
    for (const query of this.queries.getQueryCache().getAll()) {
      if (query.getObserversCount() === 0 || (query.meta?.private === true && query.meta?.ownerId !== ownerId)) continue
      const [resource, id, owner] = query.queryKey
      if (resource === 'catalog') catalog = true
      if (resource === 'nft' && typeof id === 'string') nftIds.add(id)
      if (resource === 'order' && typeof id === 'string' && ownerId && owner === ownerId) orderIds.add(id)
      if (resource === 'favorites' && ownerId && query.meta?.ownerId === ownerId) {
        const favorites = query.state.data as { items?: Array<{ id?: unknown }> } | undefined
        for (const nft of favorites?.items ?? []) if (typeof nft.id === 'string') nftIds.add(nft.id)
      }
      if (resource === 'quote' && ownerId && query.meta?.private === true && query.meta.ownerId === ownerId) {
        const result = query.state.data as { quote?: { lines?: Array<{ nftId?: unknown }> } } | undefined
        for (const line of result?.quote?.lines ?? []) if (typeof line.nftId === 'string') nftIds.add(line.nftId)
      }
      if (resource === 'cart' && (ownerId ? query.meta?.ownerId === ownerId : query.meta?.visitor === true)) {
        const cart = query.state.data as Cart | undefined
        for (const line of cart?.lines ?? []) if (typeof line.nftId === 'string') nftIds.add(line.nftId)
      }
    }
    return { catalog, nftIds: [...nftIds].sort(), orderIds: [...orderIds].sort() }
  }
  private updateResources() {
    const resources = this.resources(this.sessions.session?.userId ?? null)
    const signature = JSON.stringify(resources)
    if (signature === this.signature) return
    this.signature = signature
    this.sync?.setResources(resources)
  }
  private queueUpdate = () => {
    if (this.queued) return
    this.queued = true
    queueMicrotask(() => { this.queued = false; if (this.stopQueries) this.updateResources() })
  }
  private onFocus = () => {
    this.sync?.setResources(this.resources(this.sessions.session?.userId ?? null))
  }
  private bind = (session: Session | null) => {
    const generation = ++this.generation
    this.sessionGeneration = this.sessions.sessionGeneration
    this.setReady(false)
    this.sync?.stop()
    this.signature = ''
    const identity = session ? { token: session.token, ownerId: session.userId } : { visitorId: visitorId(this.storage), ownerId: null }
    const reconciliation = createQueryReconciliation(this.queries, identity.ownerId)
    this.sync = new RealtimeSynchronizer(this.socketFactory(), identity, {
      ...reconciliation,
      onReady: (value) => { if (generation === this.generation && this.sessionGeneration === this.sessions.sessionGeneration) this.setReady(value) },
      onRejected: () => { if (generation === this.generation && session && this.sessions.session?.token === session.token) void this.sessions.clear() },
      onError: (error) => { if (generation === this.generation) this.onError(error) },
    })
    this.updateResources()
    this.sync.start()
  }
  retryReconciliation() {
    this.sync?.setResources(this.resources(this.sessions.session?.userId ?? null))
  }
  start() {
    if (this.stopSession) return
    this.stopSession = this.sessions.subscribe(this.bind)
    this.stopQueries = this.queries.getQueryCache().subscribe(this.queueUpdate)
    window.addEventListener('focus', this.onFocus)
    this.bind(this.sessions.session)
  }
  stop() {
    ++this.generation
    this.stopSession?.(); this.stopSession = null
    this.stopQueries?.(); this.stopQueries = null
    window.removeEventListener('focus', this.onFocus)
    this.sync?.stop(); this.sync = null
    this.sessionGeneration = -1
    this.signature = ''
    this.setReady(false)
  }
}
