import type { AxiosInstance } from 'axios'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { orderSchema, profileSchema, walletListSchema } from './contracts.ts'
import type { SessionManager } from './session.ts'
import type { EventGate } from '../realtime/event-gate.ts'

export class StaleOrderResponse extends Error {
  constructor() { super('Order response is stale or belongs to an inactive connection'); this.name = 'StaleOrderResponse' }
}

/** Query keys and guards bind private responses to the session that requested them. */
export function privateQueries(http: AxiosInstance, sessions: SessionManager, getGate: () => EventGate | null = () => null) {
  function identity() {
    const session = sessions.session
    if (!session) throw new Error('Authentication required')
    return { token: session.token, ownerId: session.userId, generation: sessions.sessionGeneration }
  }
  function make<T>(resource: string, path: string, schema: z.ZodType<T>, resourceId?: string, belongsToOwner?: (data: T, ownerId: string) => boolean, validateVersion?: (data: T, gate: EventGate) => boolean) {
    const captured = identity()
    const key = resourceId ? [resource, resourceId, captured.ownerId, captured.generation] : [resource, captured.ownerId, captured.generation]
    const check = () => {
      if (sessions.sessionGeneration !== captured.generation || sessions.session?.token !== captured.token || sessions.session?.userId !== captured.ownerId) throw new Error('Session changed')
    }
    return queryOptions({
      queryKey: key,
      meta: { private: true, ownerId: captured.ownerId },
      staleTime: resource === 'order' ? 0 : undefined,
      queryFn: async ({ signal }) => {
        check()
        const gate = validateVersion ? getGate() : null
        if (validateVersion && !gate) throw new StaleOrderResponse()
        const response = await http.get(path, { signal, headers: { Authorization: `Bearer ${captured.token}` } })
        check()
        const data = schema.parse(response.data)
        check()
        if (belongsToOwner && !belongsToOwner(data, captured.ownerId)) throw new Error('Response owner mismatch')
        if (validateVersion && (!gate || getGate() !== gate || !validateVersion(data, gate))) throw new StaleOrderResponse()
        return data
      },
    })
  }
  return {
    profile: () => make('profile', '/profile', profileSchema, undefined, (profile, ownerId) => profile.id === ownerId, (profile, gate) => gate.observePrivate('profile', profile.id, profile.version)),
    wallets: () => {
      const ownerId = identity().ownerId
      return make('wallets', '/wallets', walletListSchema, undefined, undefined, (wallets, gate) => gate.observePrivate('wallets', ownerId, wallets.version))
    },
    order: (id: string) => make('order', `/orders/${encodeURIComponent(id)}`, orderSchema, id, (order, ownerId) => order.id === id && order.ownerUserId === ownerId, (order, gate) => gate.observeOrder(order.id, order.version, order.status)),
  }
}
