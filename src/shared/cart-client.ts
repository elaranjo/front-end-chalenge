import axios, { type AxiosInstance, type Method } from 'axios'
import type { QueryClient } from '@tanstack/react-query'
import { cartSchema, type Cart, type Edition } from './contracts.ts'
import type { SessionManager } from './session.ts'
import type { EventGate } from '../realtime/event-gate.ts'
import { visitorId, VISITOR_KEY } from './visitor-cart.ts'
import { cartQueries } from './cart-queries.ts'

/** Mutations require an explicit revision; additions also require a stable operation ID. */
export class CartClient {
  private readonly http: AxiosInstance
  private readonly queries: QueryClient
  private readonly sessions: SessionManager
  private readonly storage: Storage
  private readonly getGate: () => EventGate | null
  private readonly uncertain = new Set<string>()
  private readonly pending = new Set<string>()
  constructor(http: AxiosInstance, queries: QueryClient, sessions: SessionManager, storage: Storage, getGate: () => EventGate | null) {
    this.http = http; this.queries = queries; this.sessions = sessions; this.storage = storage; this.getGate = getGate
  }
  private async mutate(method: Method, url: string, revision: number, data?: unknown, mutationId?: string): Promise<Cart> {
    if (!Number.isSafeInteger(revision) || revision < 0) throw new RangeError('Invalid cart revision')
    const session = this.sessions.session
    const generation = this.sessions.sessionGeneration
    const owner = session ? { kind: 'user' as const, id: session.userId } : { kind: 'visitor' as const, id: visitorId(this.storage) }
    const gate = this.getGate()
    if (!gate) throw new Error('Realtime state is not ready')
    const key = ['cart', `${owner.kind}:${owner.id}`, generation] as const
    const scope = `${generation}:${owner.kind}:${owner.id}`
    if (this.uncertain.has(scope)) throw new Error('Reconcile the cart before another mutation')
    if (this.pending.has(scope)) throw new Error('Cart mutation already in progress')
    const current = () => this.sessions.sessionGeneration === generation && this.getGate() === gate && (session ? this.sessions.session?.token === session.token : !this.sessions.session && this.storage.getItem(VISITOR_KEY) === owner.id)
    const query = this.queries.getQueryCache().build(this.queries, { queryKey: key, meta: session ? { private: true, ownerId: owner.id } : { visitor: true } })
    query.setOptions({ ...query.options, meta: session ? { private: true, ownerId: owner.id } : { visitor: true } })
    this.pending.add(scope)
    try {
      await this.queries.cancelQueries({ queryKey: key, exact: true })
      if (!current()) throw new Error('Session changed')
      const response = await this.http.request({ method, url, data, headers: { ...(session ? { Authorization: `Bearer ${session.token}` } : { 'X-Visitor-Id': owner.id }), 'If-Match': String(revision), ...(mutationId ? { 'X-Mutation-Id': mutationId } : {}) } })
      if (!current()) throw new Error('Session changed')
      const cart = cartSchema.parse(response.data)
      if (cart.id !== `${owner.kind}:${owner.id}` || cart.ownerKind !== owner.kind || !gate.observeCart(cart.id, cart.revision, cart.catalogVersion)) throw new Error('Stale cart response')
      this.queries.setQueryData(key, cart)
      return cart
    } catch (error) {
      if (current()) {
        if (!axios.isAxiosError(error) || !error.response || error.response.status >= 500 || error.response.status === 408) this.uncertain.add(scope)
        void this.queries.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' })
      }
      throw error
    } finally { this.pending.delete(scope) }
  }
  async reconcile(): Promise<Cart> {
    const session = this.sessions.session
    const generation = this.sessions.sessionGeneration
    const owner = session ? { kind: 'user' as const, id: session.userId } : { kind: 'visitor' as const, id: visitorId(this.storage) }
    const scope = `${generation}:${owner.kind}:${owner.id}`
    if (this.pending.has(scope)) throw new Error('Cart mutation already in progress')
    const options = cartQueries(this.http, this.sessions, this.storage, this.getGate).current()
    const cart = await this.queries.fetchQuery({ ...options, staleTime: 0 })
    if (this.sessions.sessionGeneration !== generation || (session ? this.sessions.session?.token !== session.token : this.sessions.session || this.storage.getItem(VISITOR_KEY) !== owner.id)) throw new Error('Session changed')
    this.uncertain.delete(scope)
    return cart
  }
  add(input: { nftId: string; editionId: Edition['id']; quantity: number; mutationId: string }, revision: number) {
    if (!input.mutationId) throw new Error('Mutation ID required')
    const { mutationId, ...body } = input
    return this.mutate('POST', '/cart/items', revision, body, mutationId)
  }
  change(lineId: string, quantity: number, revision: number) { return this.mutate('PATCH', `/cart/items/${encodeURIComponent(lineId)}`, revision, { quantity }) }
  remove(lineId: string, revision: number) { return this.mutate('DELETE', `/cart/items/${encodeURIComponent(lineId)}`, revision) }
  applyCoupon(code: string, revision: number) { return this.mutate('PUT', '/cart/coupon', revision, { code }) }
  removeCoupon(revision: number) { return this.mutate('DELETE', '/cart/coupon', revision) }
}
