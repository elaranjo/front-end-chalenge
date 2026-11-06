import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { z } from 'zod'
import { readSession } from './auth-handlers.ts'
import { onMockEventReplay, onMockSocketDisconnect, onOutboxChange } from './outbox-bridge.ts'
import { onMockReset } from '../shared/reset-signal.ts'
import type { MockNow } from './mock-clock.ts'

const bindSchema = z.object({ token: z.string().min(1).optional(), visitorId: z.uuid().optional(), nonce: z.string().min(1) }).refine((value) => Boolean(value.token) !== Boolean(value.visitorId))
const subscribeSchema = z.object({ catalog: z.boolean(), nftIds: z.array(z.string()), orderIds: z.array(z.string()), requestId: z.string().min(1).optional() })
type Event = { id: string; eventId: string; type: 'nft.updated' | 'order.updated'; resourceId: string; version: number; ownerUserId?: string; [key: string]: unknown }

async function getAll<T>(database: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store)
    const request = tx.objectStore(store).getAll()
    tx.oncomplete = () => resolve(request.result as T[])
    tx.onabort = () => reject(tx.error)
  })
}

export function socketHandlers(database: IDBDatabase, origin: string, now: MockNow = Date.now) {
  // MSW normalizes the Socket.IO /socket.io/ path to the origin for matching.
  const link = ws.link(origin.replace(/^http/, 'ws'))
  return [link.addEventListener('connection', (connection) => {
    const socket = toSocketIo(connection)
    let identity: { token?: string; userId?: string; sessionId: string; nonce: string } | undefined
    let subscription = { catalog: false, nftIds: [] as string[], orderIds: [] as string[] }
    let closed = false
    let bindGeneration = 0
    let subscriptionGeneration = 0
    let flushing = false
    let needsFlush = false
    const seen = new Set<string>()

    const flush = async () => {
      if (!identity || closed) return
      if (flushing) { needsFlush = true; return }
      flushing = true
      try {
        do {
          needsFlush = false
          const current: { token?: string; userId?: string; sessionId: string; nonce: string } = identity
          if (current.token && !await readSession(database, current.token, await now())) {
            if (identity !== current) return
            socket.client.emit('session.rejected', { reason: 'SESSION_EXPIRED' })
            identity = undefined
            return
          }
          if (identity !== current) return
          const events = await getAll<Event>(database, 'outbox')
          if (identity !== current || closed) return
          for (const event of events) {
            if (closed || !identity || seen.has(event.eventId)) continue
            seen.add(event.eventId)
            const authorized = event.type === 'nft.updated'
              ? subscription.catalog || subscription.nftIds.includes(event.resourceId)
              : event.ownerUserId === identity.userId && subscription.orderIds.includes(event.resourceId)
            if (authorized) {
              const { id: _id, ...payload } = event
              socket.client.emit(event.type, event.type === 'order.updated' ? { ...payload, targetSessionId: identity.sessionId } : payload)
            }
          }
        } while (needsFlush && !closed)
      } finally { flushing = false }
    }
    const unsubscribe = onOutboxChange(() => { void flush() })
    const unsubscribeDisconnect = onMockSocketDisconnect(() => connection.client.close(1012, 'Mock disconnect'))
    const unsubscribeReplay = onMockEventReplay(({ eventId, replacementId }) => {
      const current = identity
      if (!current || closed) return
      void (async () => {
        if (current.token && !await readSession(database, current.token, await now())) return
        const event = (await getAll<Event>(database, 'outbox')).find((item) => item.eventId === eventId)
        if (!event || identity !== current || closed) return
        const authorized = event.type === 'nft.updated'
          ? subscription.catalog || subscription.nftIds.includes(event.resourceId)
          : event.ownerUserId === current.userId && subscription.orderIds.includes(event.resourceId)
        if (!authorized) return
        const { id: _id, ...payload } = event
        const replay = replacementId ? { ...payload, eventId: replacementId, version: event.version - 1 } : payload
        socket.client.emit(event.type, event.type === 'order.updated' ? { ...replay, targetSessionId: current.sessionId } : replay)
      })()
    })
    const unsubscribeReset = onMockReset(() => {
      closed = true
      identity = undefined
      unsubscribe()
      unsubscribeDisconnect()
      unsubscribeReplay()
      unsubscribeReset()
      connection.client.close(1000, 'Mock reset')
    })
    connection.client.addEventListener('close', () => { closed = true; identity = undefined; unsubscribe(); unsubscribeDisconnect(); unsubscribeReplay(); unsubscribeReset() })
    socket.client.on('session.bind', async (_event, value) => {
      const generation = ++bindGeneration
      identity = undefined
      subscription = { catalog: false, nftIds: [], orderIds: [] }
      const parsed = bindSchema.safeParse(value)
      if (!parsed.success) { socket.client.emit('session.rejected', { reason: 'INVALID_BIND' }); return }
      const session = parsed.data.token ? await readSession(database, parsed.data.token, await now()) : undefined
      if (closed || generation !== bindGeneration) return
      if (parsed.data.token && !session) { socket.client.emit('session.rejected', { reason: 'SESSION_EXPIRED' }); return }
      identity = { token: parsed.data.token, userId: session?.session.userId, sessionId: session?.session.sessionId ?? parsed.data.visitorId!, nonce: parsed.data.nonce }
      // REST reconciliation supplies the initial state; only subsequent notifications are delivered.
      for (const event of await getAll<Event>(database, 'outbox')) seen.add(event.eventId)
      if (!closed && generation === bindGeneration && identity) socket.client.emit('session.ready', { sessionId: identity.sessionId, nonce: identity.nonce })
    })
    socket.client.on('resources.subscribe', async (_event, value) => {
      const generation = ++subscriptionGeneration
      const parsed = subscribeSchema.safeParse(value)
      if (!identity || !parsed.success) return
      const current = identity
      const orders = await getAll<{ id: string; ownerUserId: string }>(database, 'orders')
      if (identity !== current || closed || generation !== subscriptionGeneration) return
      subscription = { catalog: parsed.data.catalog, nftIds: parsed.data.nftIds, orderIds: parsed.data.orderIds.filter((id) => orders.some((order) => order.id === id && order.ownerUserId === current.userId)) }
      socket.client.emit('resources.subscribed', { ...subscription, ...(parsed.data.requestId ? { requestId: parsed.data.requestId } : {}) })
    })
  })]
}
