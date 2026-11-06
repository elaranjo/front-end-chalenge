import { z } from 'zod'
import { editionSchema } from '../shared/contracts.ts'

const base = {
  eventId: z.string().min(1), resourceId: z.string().min(1), version: z.number().int().nonnegative().safe(), occurredAt: z.iso.datetime(),
}
const eventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('nft.updated'), catalogVersion: z.number().int().nonnegative().safe(), payload: z.object({ nftId: z.string().min(1), editions: z.array(editionSchema) }) }),
  z.object({ ...base, type: z.literal('order.updated'), ownerUserId: z.string().min(1), targetSessionId: z.string().min(1), payload: z.object({ orderId: z.string().min(1), status: z.enum(['pending', 'confirmed', 'declined']) }) }),
])
export type RealtimeEvent = z.infer<typeof eventSchema>

/** One instance belongs to one session generation and is discarded on logout. */
export class EventGate {
  private readonly seen = new Set<string>()
  private readonly versions = new Map<string, number>()
  private readonly terminal = new Map<string, 'confirmed' | 'declined'>()
  private catalogVersionValue = 0
  private readonly ownerId: string | null
  private readonly sessionId: string

  constructor(ownerId: string | null, sessionId: string) {
    this.ownerId = ownerId
    this.sessionId = sessionId
  }

  get catalogVersion() { return this.catalogVersionValue }

  observePrivate(resource: 'profile' | 'wallets', ownerId: string, version: number) {
    if (ownerId !== this.ownerId || !Number.isSafeInteger(version) || version < 0) return false
    const key = `${resource}:${ownerId}`
    if (version < (this.versions.get(key) ?? -1)) return false
    this.versions.set(key, version)
    return true
  }

  observeCatalog(version: number) {
    if (!Number.isSafeInteger(version) || version < this.catalogVersionValue) return false
    this.catalogVersionValue = version
    return true
  }

  observeCart(id: string, revision: number, catalogVersion: number) {
    const key = `cart:${id}`
    if (!Number.isSafeInteger(revision) || revision < 0 || !Number.isSafeInteger(catalogVersion) || catalogVersion < this.catalogVersionValue || revision < (this.versions.get(key) ?? -1)) return false
    this.versions.set(key, revision)
    this.catalogVersionValue = catalogVersion
    return true
  }

  /** REST watermarks prevent stale REST responses and stale events from regressing state. */
  observeNft(id: string, version: number, catalogVersion: number) {
    const key = `nft:${id}`
    const current = this.versions.get(key) ?? -1
    if (version < current || catalogVersion < this.catalogVersionValue) return false
    this.versions.set(key, version)
    this.catalogVersionValue = catalogVersion
    return true
  }

  observeOrder(id: string, version: number, status: 'pending' | 'confirmed' | 'declined') {
    const key = `order:${id}`
    const terminal = this.terminal.get(id)
    if (version < (this.versions.get(key) ?? -1) || (terminal && terminal !== status)) return false
    this.versions.set(key, version)
    if (status !== 'pending') this.terminal.set(id, status)
    return true
  }

  accept(raw: unknown): RealtimeEvent | null {
    const parsed = eventSchema.safeParse(raw)
    if (!parsed.success) return null
    const event = parsed.data
    if (this.seen.has(event.eventId)) return null
    if (event.type === 'nft.updated' && event.payload.nftId !== event.resourceId) return null
    if (event.type === 'order.updated' && (event.ownerUserId !== this.ownerId || event.targetSessionId !== this.sessionId || event.payload.orderId !== event.resourceId)) return null
    const key = `${event.type === 'nft.updated' ? 'nft' : 'order'}:${event.resourceId}`
    if (event.version <= (this.versions.get(key) ?? -1)) return null
    if (event.type === 'nft.updated' && event.catalogVersion < this.catalogVersionValue) return null
    if (event.type === 'order.updated' && this.terminal.has(event.resourceId)) return null
    this.seen.add(event.eventId)
    if (this.seen.size > 1000) this.seen.delete(this.seen.values().next().value!)
    this.versions.set(key, event.version)
    if (event.type === 'nft.updated') this.catalogVersionValue = Math.max(this.catalogVersionValue, event.catalogVersion)
    // An order event never establishes a terminal state; only an authorized REST response can.
    return event
  }
}
