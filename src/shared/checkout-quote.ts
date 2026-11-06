import type { AxiosInstance } from 'axios'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import type { EventGate } from '../realtime/event-gate.ts'
import { networkSchema, providerSchema, quoteSchema } from './contracts.ts'
import type { SessionManager } from './session.ts'

const requestSchema = z.object({ cartRevision: z.number().int().nonnegative().safe(), walletId: z.string().min(1), network: networkSchema, provider: providerSchema })
export type CheckoutQuoteRequest = z.infer<typeof requestSchema>

/** Fetch a quote for the current owner and reject responses superseded by session or catalog changes. */
export class CheckoutQuoteClient {
  private readonly http: AxiosInstance
  private readonly sessions: SessionManager
  private readonly getGate: () => EventGate | null
  private readonly now: () => number
  constructor(http: AxiosInstance, sessions: SessionManager, getGate: () => EventGate | null, now: () => number = Date.now) {
    this.http = http; this.sessions = sessions; this.getGate = getGate; this.now = now
  }

  query(input: CheckoutQuoteRequest) {
    const request = requestSchema.parse(input)
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    const generation = this.sessions.sessionGeneration
    const check = () => {
      if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token || this.sessions.session.userId !== session.userId) throw new Error('Session changed')
    }
    return queryOptions({
      queryKey: ['quote', session.userId, generation, request] as const,
      meta: { private: true, ownerId: session.userId }, staleTime: 0, retry: false,
      queryFn: async ({ signal }) => { check(); const result = await this.fetch(request, signal); check(); return result },
    })
  }

  async fetch(input: CheckoutQuoteRequest, signal?: AbortSignal) {
    const request = requestSchema.parse(input)
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    const generation = this.sessions.sessionGeneration
    const gate = this.getGate()
    if (!gate) throw new Error('Realtime state is not ready')
    const response = await this.http.post('/quotes', request, { signal, headers: { Authorization: `Bearer ${session.token}` } })
    if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token || this.sessions.session.userId !== session.userId) throw new Error('Session changed')
    const quote = quoteSchema.parse(response.data)
    if (quote.cartId !== `user:${session.userId}` || quote.cartRevision !== request.cartRevision || quote.network !== request.network) throw new Error('Invalid quote response')
    if (this.getGate() !== gate || !gate.observeCart(quote.cartId, quote.cartRevision, quote.catalogVersion)) throw new Error('Quote is older than the current cart or catalog')
    const serverTime = response.headers['x-server-time']
    const checkedAt = serverTime === undefined ? this.now() : Date.parse(String(serverTime))
    if (!Number.isFinite(checkedAt)) throw new Error('Invalid server time')
    return { quote, checkedAt }
  }
}
