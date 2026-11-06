import type { AxiosInstance } from 'axios'
import type { Session } from './contracts.ts'
import type { SessionManager } from './session.ts'
import { mergeVisitorCart, PENDING_MERGE_KEY, visitorId } from './visitor-cart.ts'

/** Authentication can succeed before a network failure in the cart merge. */
export class CartMergePending extends Error {
  readonly cause: unknown
  constructor(cause: unknown) {
    super('A sessão foi iniciada, mas o carrinho ainda precisa ser sincronizado.')
    this.name = 'CartMergePending'
    this.cause = cause
  }
}

export class AuthFlow {
  private readonly listeners = new Set<() => void>()
  private readonly session: SessionManager
  private readonly http: AxiosInstance
  private readonly storage: Storage
  constructor(session: SessionManager, http: AxiosInstance, storage: Storage) {
    this.session = session
    this.http = http
    this.storage = storage
  }

  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private notify() { for (const listener of this.listeners) listener() }

  private pendingFor(ownerUserId: string): { ownerUserId: string; visitorId: string } | null {
    try {
      const raw: unknown = JSON.parse(this.storage.getItem(PENDING_MERGE_KEY) ?? 'null')
      if (raw && typeof raw === 'object' && 'ownerUserId' in raw && raw.ownerUserId === ownerUserId && 'visitorId' in raw && typeof raw.visitorId === 'string' && raw.visitorId) return { ownerUserId, visitorId: raw.visitorId }
    } catch { /* Invalid persisted state cannot be used for a merge. */ }
    return null
  }

  hasPendingMerge() {
    const owner = this.session.session?.userId
    return Boolean(owner && this.pendingFor(owner))
  }

  async login(email: string, password: string) {
    const authenticated = await this.session.login(email, password)
    return this.finish(authenticated)
  }

  async signup(username: string, email: string, password: string, confirmation: string) {
    const authenticated = await this.session.signup(username, email, password, confirmation)
    return this.finish(authenticated)
  }

  async retryMerge() {
    return this.finish(this.session.session)
  }

  private async finish(authenticated: Session | null) {
    if (!authenticated || authenticated !== this.session.session) throw new Error('Authentication was superseded')
    const generation = this.session.sessionGeneration
    const pending = this.pendingFor(authenticated.userId) ?? { ownerUserId: authenticated.userId, visitorId: visitorId(this.storage) }
    this.storage.setItem(PENDING_MERGE_KEY, JSON.stringify(pending))
    this.notify()
    try {
      const merged = await mergeVisitorCart(this.http, this.storage, authenticated.token, () => this.session.sessionGeneration === generation && this.session.session?.userId === authenticated.userId, pending.visitorId)
      if (this.session.sessionGeneration !== generation || this.session.session?.userId !== authenticated.userId) {
        throw new Error('Session changed during cart merge')
      }
      const current = this.pendingFor(authenticated.userId)
      if (current?.visitorId === pending.visitorId) this.storage.removeItem(PENDING_MERGE_KEY)
      this.notify()
      return { session: authenticated, ...merged }
    } catch (error) {
      throw new CartMergePending(error)
    }
  }
}
