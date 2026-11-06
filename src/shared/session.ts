import axios, { type AxiosInstance } from 'axios'
import type { Query, QueryClient } from '@tanstack/react-query'
import { sessionSchema, type Session } from './contracts.ts'
import { ORDER_ATTEMPT_KEY } from './order-attempt.ts'
import { PENDING_MERGE_KEY, rotateVisitorId } from './visitor-cart.ts'
import { CHECKOUT_DRAFT_KEY } from './checkout-draft.ts'

const TOKEN_KEY = 'kurio.session-token'

/** Coordinates the client session; private queries must declare meta.private. */
export class SessionManager {
  private generation = 0
  private current: Session | null = null
  private listeners = new Set<(session: Session | null) => void>()

  private readonly http: AxiosInstance
  private readonly queries: QueryClient
  private readonly storage: Storage

  constructor(http: AxiosInstance, queries: QueryClient, storage: Storage) {
    this.http = http
    this.queries = queries
    this.storage = storage
  }

  get session(): Session | null { return this.current }
  get sessionGeneration(): number { return this.generation }
  subscribe(listener: (session: Session | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async clearPrivate(): Promise<void> {
    const previous = new Set(this.queries.getQueryCache().getAll().filter((query) => query.meta?.private === true))
    const previousPrivate = { predicate: (query: Query) => previous.has(query) }
    await this.queries.cancelQueries(previousPrivate)
    this.queries.removeQueries(previousPrivate)
  }

  private storedOwner(key: string): string | null {
    const raw = this.storage.getItem(key)
    if (!raw) return null
    try {
      const value: unknown = JSON.parse(raw)
      return value && typeof value === 'object' && 'ownerUserId' in value && typeof value.ownerUserId === 'string' ? value.ownerUserId : null
    } catch { return null }
  }

  private async accept(data: unknown, generation: number): Promise<Session | null> {
    const session = sessionSchema.parse(data)
    if (generation !== this.generation) return null
    await this.clearPrivate()
    if (generation !== this.generation) return null
    const pendingOwner = this.storedOwner(PENDING_MERGE_KEY)
    if ((this.current && this.current.userId !== session.userId) || (pendingOwner && pendingOwner !== session.userId)) rotateVisitorId(this.storage)
    for (const key of [ORDER_ATTEMPT_KEY, CHECKOUT_DRAFT_KEY, PENDING_MERGE_KEY]) if (this.storage.getItem(key) && this.storedOwner(key) !== session.userId) this.storage.removeItem(key)
    this.current = session
    this.storage.setItem(TOKEN_KEY, session.token)
    for (const listener of this.listeners) listener(session)
    return session
  }

  async login(email: string, password: string): Promise<Session | null> {
    const generation = ++this.generation
    for (const listener of this.listeners) listener(this.current)
    const response = await this.http.post('/auth/login', { email, password })
    return this.accept(response.data, generation)
  }

  async signup(username: string, email: string, password: string, passwordConfirmation: string): Promise<Session | null> {
    const generation = ++this.generation
    for (const listener of this.listeners) listener(this.current)
    const response = await this.http.post('/auth/signup', { username, email, password, passwordConfirmation })
    return this.accept(response.data, generation)
  }

  async restore(): Promise<Session | null> {
    const token = this.storage.getItem(TOKEN_KEY)
    if (!token) return null
    const generation = ++this.generation
    for (const listener of this.listeners) listener(this.current)
    try {
      const response = await this.http.get('/auth/session', { headers: { Authorization: `Bearer ${token}` } })
      return await this.accept(response.data, generation)
    } catch (error) {
      if (generation === this.generation && axios.isAxiosError(error) && error.response?.status === 401) await this.clear()
      throw error
    }
  }

  async clear(): Promise<void> {
    ++this.generation
    this.current = null
    this.storage.removeItem(TOKEN_KEY)
    for (const listener of this.listeners) listener(null)
    await this.clearPrivate()
  }

  /** Another tab already changed storage: remove private state without overwriting its token. */
  async clearForExternalChange(): Promise<void> {
    ++this.generation
    const owner = this.current?.userId
    this.current = null
    for (const key of [ORDER_ATTEMPT_KEY, CHECKOUT_DRAFT_KEY, PENDING_MERGE_KEY]) if (owner && this.storedOwner(key) === owner) this.storage.removeItem(key)
    for (const listener of this.listeners) listener(null)
    await this.clearPrivate()
  }

  async logout(): Promise<void> {
    const token = this.current?.token ?? this.storage.getItem(TOKEN_KEY)
    this.storage.removeItem(ORDER_ATTEMPT_KEY)
    this.storage.removeItem(CHECKOUT_DRAFT_KEY)
    this.storage.removeItem(PENDING_MERGE_KEY)
    rotateVisitorId(this.storage)
    await this.clear()
    if (token) await this.http.post('/auth/logout', undefined, { headers: { Authorization: `Bearer ${token}` } })
  }
}
