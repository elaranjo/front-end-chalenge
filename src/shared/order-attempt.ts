import axios, { type AxiosInstance } from 'axios'
import { z } from 'zod'
import { orderInputSchema, orderSchema, type Order } from './contracts.ts'
import type { SessionManager } from './session.ts'

const attemptSchema = z.object({ ownerUserId: z.string().min(1), key: z.uuid(), payload: orderInputSchema })
type Attempt = z.infer<typeof attemptSchema>
export type OrderAttemptInput = z.infer<typeof orderInputSchema>
export const ORDER_ATTEMPT_KEY = 'kurio.order-attempt'

/** The frozen request is persisted before POST and is never reconstructed during recovery. */
export class OrderAttemptManager {
  private inFlight: Promise<Order> | null = null
  private flightIdentity: { token: string; generation: number } | null = null
  private flightPayload: string | null = null
  private readonly http: AxiosInstance
  private readonly sessions: SessionManager
  private readonly storage: Storage
  constructor(http: AxiosInstance, sessions: SessionManager, storage: Storage) {
    this.http = http
    this.sessions = sessions
    this.storage = storage
  }
  private current(): Attempt | null {
    const raw = this.storage.getItem(ORDER_ATTEMPT_KEY)
    if (!raw) return null
    let value: unknown
    try { value = JSON.parse(raw) } catch { throw new Error('Invalid stored order attempt') }
    return attemptSchema.parse(value)
  }
  private identity(attempt: Attempt) {
    const session = this.sessions.session
    if (!session || session.userId !== attempt.ownerUserId) throw new Error('The original account must authenticate to recover this attempt')
    return { session, generation: this.sessions.sessionGeneration }
  }
  private verify(ownerUserId: string, token: string, generation: number, value: unknown) {
    if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== token || this.sessions.session?.userId !== ownerUserId) throw new Error('Session changed')
    const order = orderSchema.parse(value)
    if (order.ownerUserId !== ownerUserId) throw new Error('Order owner mismatch')
    return order
  }
  private verifyAttempt(attempt: Attempt) {
    if (JSON.stringify(this.current()) !== JSON.stringify(attempt)) throw new Error('Order attempt changed')
  }
  hasAttempt(): boolean {
    const attempt = this.current()
    return !!attempt && attempt.ownerUserId === this.sessions.session?.userId
  }
  private locked<T>(callback: () => Promise<T>): Promise<T> {
    if (typeof window === 'undefined') return callback()
    if (!navigator.locks) return Promise.reject(new Error('Cross-tab locking is unavailable'))
    return navigator.locks.request('kurio.order-attempt', callback)
  }
  private track(request: Promise<Order>, token: string, generation: number, payload: string): Promise<Order> {
    this.inFlight = request
    this.flightIdentity = { token, generation }
    this.flightPayload = payload
    void request.finally(() => { if (this.inFlight === request) { this.inFlight = null; this.flightIdentity = null; this.flightPayload = null } }).catch(() => {})
    return request
  }
  create(input: OrderAttemptInput): Promise<Order> {
    const session = this.sessions.session
    if (!session) return Promise.reject(new Error('Authentication required'))
    const payload = orderInputSchema.parse(input)
    const encoded = JSON.stringify(payload)
    if (this.inFlight) {
      if (this.flightIdentity?.token !== session.token || this.flightIdentity.generation !== this.sessions.sessionGeneration || this.flightPayload !== encoded) return Promise.reject(new Error('Another attempt is in progress'))
      return this.inFlight
    }
    if (this.current()) return Promise.reject(new Error('An existing attempt must be recovered first'))
    if (payload.collector.network !== payload.network) return Promise.reject(new Error('Collector and wallet network must match'))
    const generation = this.sessions.sessionGeneration
    const operation = this.locked(async () => {
      if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token) throw new Error('Session changed')
      const existing = this.current()
      if (existing && (existing.ownerUserId !== session.userId || JSON.stringify(existing.payload) !== encoded)) throw new Error('Another attempt is in progress')
      const attempt = existing ?? attemptSchema.parse({ ownerUserId: session.userId, key: crypto.randomUUID(), payload: structuredClone(payload) })
      if (!existing) this.storage.setItem(ORDER_ATTEMPT_KEY, JSON.stringify(attempt))
      return this.send(attempt)
    })
    return this.track(operation, session.token, generation, encoded)
  }
  retry(): Promise<Order> {
    if (this.inFlight) {
      if (this.flightIdentity?.token !== this.sessions.session?.token || this.flightIdentity?.generation !== this.sessions.sessionGeneration) return Promise.reject(new Error('Session changed'))
      return this.inFlight
    }
    const attempt = this.current()
    if (!attempt) return Promise.reject(new Error('No saved attempt'))
    const { session, generation } = this.identity(attempt)
    const operation = this.locked(async () => {
      if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token || this.current()?.key !== attempt.key) throw new Error('Session or attempt changed')
      return this.send(attempt)
    })
    return this.track(operation, session.token, generation, JSON.stringify(attempt.payload))
  }
  private send(attempt: Attempt): Promise<Order> {
    const { session, generation } = this.identity(attempt)
    return this.http.post('/orders', attempt.payload, { headers: { Authorization: `Bearer ${session.token}`, 'Idempotency-Key': attempt.key } })
      .then((response) => { this.verifyAttempt(attempt); return this.verify(attempt.ownerUserId, session.token, generation, response.data) })
      .catch((error: unknown) => {
        const code: unknown = axios.isAxiosError(error) ? error.response?.data?.error?.code : undefined
        if (axios.isAxiosError(error) && error.response?.status === 409 && (code === 'STALE_QUOTE' || code === 'CONNECTION_INVALID') && this.sessions.sessionGeneration === generation && this.sessions.session?.token === session.token) {
          this.verifyAttempt(attempt)
          this.storage.removeItem(ORDER_ATTEMPT_KEY)
        }
        throw error
      })
  }
  async recover(): Promise<Order> {
    const attempt = this.current()
    if (!attempt) throw new Error('No saved attempt')
    const { session, generation } = this.identity(attempt)
    const response = await this.http.get(`/orders/attempts/${encodeURIComponent(attempt.key)}`, { headers: { Authorization: `Bearer ${session.token}` } })
    this.verifyAttempt(attempt)
    return this.verify(attempt.ownerUserId, session.token, generation, response.data)
  }
  /** Caller may clear after an explicit pre-commit rejection, terminal outcome, or logout. */
  clear(): void { this.storage.removeItem(ORDER_ATTEMPT_KEY) }
}
