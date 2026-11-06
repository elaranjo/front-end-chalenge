import type { AxiosInstance } from 'axios'
import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { nftSchema, type NFT } from './contracts.ts'
import type { SessionManager } from './session.ts'
import type { EventGate } from '../realtime/event-gate.ts'

const listSchema = z.object({ items: z.array(nftSchema), version: z.number().int().nonnegative().safe() })
const resultSchema = z.object({ nftId: z.string(), favorite: z.boolean(), version: z.number().int().nonnegative().safe() })
type List = z.infer<typeof listSchema>

/** Owns optimistic state for a session generation; never automatically retries a mutation. */
export class FavoritesClient {
  private readonly queues = new Map<string, Promise<void>>()
  private readonly revisions = new Map<string, number>()
  private readonly uncertain = new Set<string>()
  private readonly versions = new Map<string, number>()
  private readonly http: AxiosInstance
  private readonly queries: QueryClient
  private readonly sessions: SessionManager
  private readonly getGate: () => EventGate | null
  constructor(http: AxiosInstance, queries: QueryClient, sessions: SessionManager, getGate: () => EventGate | null) {
    this.http = http
    this.queries = queries
    this.sessions = sessions
    this.getGate = getGate
  }

  listQuery() {
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    const generation = this.sessions.sessionGeneration
    const check = () => {
      if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token || this.sessions.session.userId !== session.userId) throw new Error('Session changed')
    }
    return queryOptions({
      queryKey: ['favorites', session.userId, generation] as const,
      meta: { private: true, ownerId: session.userId },
      queryFn: async ({ signal }) => { check(); const result = await this.load(signal); check(); return result },
    })
  }

  async load(signal?: AbortSignal): Promise<List> {
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    const generation = this.sessions.sessionGeneration
    const gate = this.getGate()
    if (!gate) throw new Error('Realtime state is not ready')
    const response = await this.http.get('/favorites', { signal, headers: { Authorization: `Bearer ${session.token}` } })
    const list = listSchema.parse(response.data)
    if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token || this.getGate() !== gate) throw new Error('Session changed')
    const scopeId = `${generation}:${session.userId}`
    if (list.version < (this.versions.get(scopeId) ?? -1)) throw new Error('Stale favorites response')
    if (list.items.some((nft) => !gate.observeNft(nft.id, nft.version, gate.catalogVersion))) throw new Error('Stale favorites response')
    this.versions.set(scopeId, list.version)
    return list
  }

  set(nft: NFT, favorite: boolean): Promise<void> {
    const session = this.sessions.session
    if (!session) return Promise.reject(new Error('Authentication required'))
    const generation = this.sessions.sessionGeneration
    const key = ['favorites', session.userId, generation] as const
    const scopeId = `${generation}:${session.userId}`
    const scopedId = `${generation}:${nft.id}`
    const revision = (this.revisions.get(scopedId) ?? 0) + 1
    this.revisions.set(scopedId, revision)
    const stillCurrent = () => this.sessions.sessionGeneration === generation && this.sessions.session?.token === session.token
    const latest = () => stillCurrent() && this.revisions.get(scopedId) === revision
    const query = this.queries.getQueryCache().build(this.queries, { queryKey: key, meta: { private: true, ownerId: session.userId } })
    query.setOptions({ ...query.options, meta: { ...query.meta, private: true, ownerId: session.userId } })
    void this.queries.cancelQueries({ queryKey: key, exact: true })
    const before = this.queries.getQueryData<List>(key)
    const wasFavorite = before?.items.some((item) => item.id === nft.id) ?? false
    const update = (present: boolean, serverVersion?: number, source: NFT = nft) => {
      this.queries.setQueryData<List>(key, (old) => {
        const previous = old?.items.find((item) => item.id === nft.id)
        const items = (old?.items ?? []).filter((item) => item.id !== nft.id)
        if (present) items.push(previous && previous.version > source.version ? previous : source)
        return { items, version: Math.max(old?.version ?? 0, serverVersion ?? 0) }
      })
    }
    update(favorite)
    const prior = this.queues.get(scopeId) ?? Promise.resolve()
    const operation = prior.catch(() => {}).then(async () => {
      if (!stillCurrent()) throw new Error('Session changed')
      try {
        if (this.uncertain.has(scopeId)) {
          const current = await this.load()
          if (!stillCurrent()) throw new Error('Session changed')
          this.uncertain.delete(scopeId)
          if (latest()) update(favorite, current.version, current.items.find((item) => item.id === nft.id) ?? nft)
        }
        const response = await this.http.request({ method: favorite ? 'PUT' : 'DELETE', url: `/favorites/${encodeURIComponent(nft.id)}`, headers: { Authorization: `Bearer ${session.token}` } })
        const result = resultSchema.parse(response.data)
        if (result.nftId !== nft.id || result.favorite !== favorite) throw new Error('Invalid favorite response')
        if (!stillCurrent()) throw new Error('Session changed')
        if (result.version < (this.versions.get(scopeId) ?? -1)) throw new Error('Stale favorites response')
        this.versions.set(scopeId, result.version)
        if (latest()) update(favorite, result.version)
      } catch (error) {
        if (stillCurrent()) {
          this.uncertain.add(scopeId)
          try {
            const current = await this.load()
            if (stillCurrent()) this.uncertain.delete(scopeId)
            if (latest()) {
              const item = current.items.find((entry) => entry.id === nft.id)
              update(Boolean(item), current.version, item ?? nft)
            }
          } catch {
            if (latest()) {
              update(wasFavorite)
              void this.queries.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' })
            }
          }
        }
        throw error
      }
    })
    const queued = operation.then(() => {}, () => {})
    this.queues.set(scopeId, queued)
    void queued.then(() => {
      if (this.queues.get(scopeId) !== queued) return
      this.queues.delete(scopeId)
      if (stillCurrent()) void this.queries.invalidateQueries({ queryKey: key, exact: true, refetchType: 'active' })
    })
    return operation
  }
}
