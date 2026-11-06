import type { AxiosInstance } from 'axios'
import { queryOptions } from '@tanstack/react-query'
import type { EventGate } from '../realtime/event-gate.ts'
import { cartSchema } from './contracts.ts'
import type { SessionManager } from './session.ts'
import { visitorId, VISITOR_KEY } from './visitor-cart.ts'

export class StaleCartResponse extends Error {
  constructor() { super('Cart response is stale or belongs to another session'); this.name = 'StaleCartResponse' }
}

/** The active identity and revision are verified before a response reaches the query cache. */
export function cartQueries(http: AxiosInstance, sessions: SessionManager, storage: Storage, getGate: () => EventGate | null) {
  return {
    current: () => {
      const session = sessions.session
      const generation = sessions.sessionGeneration
      const owner = session ? { kind: 'user' as const, id: session.userId } : { kind: 'visitor' as const, id: visitorId(storage) }
      const key = ['cart', `${owner.kind}:${owner.id}`, generation] as const
      const current = () => sessions.sessionGeneration === generation && (session ? sessions.session?.token === session.token && sessions.session.userId === owner.id : !sessions.session && storage.getItem(VISITOR_KEY) === owner.id)
      return queryOptions({ queryKey: key, staleTime: 0, meta: session ? { private: true, ownerId: owner.id } : { visitor: true }, queryFn: async ({ signal }) => {
        const gate = getGate()
        if (!current() || !gate) throw new StaleCartResponse()
        const headers = session ? { Authorization: `Bearer ${session.token}` } : { 'X-Visitor-Id': owner.id }
        const response = await http.get('/cart', { signal, headers })
        if (!current() || getGate() !== gate) throw new StaleCartResponse()
        const cart = cartSchema.parse(response.data)
        if (cart.id !== `${owner.kind}:${owner.id}` || cart.ownerKind !== owner.kind || !gate.observeCart(cart.id, cart.revision, cart.catalogVersion)) throw new StaleCartResponse()
        return cart
      } })
    },
  }
}
