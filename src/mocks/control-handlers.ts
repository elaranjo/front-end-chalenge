import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { editionIdSchema, moneySchema, type NFT } from '../shared/contracts.ts'
import { disconnectMockSockets, notifyOutbox, replayMockEvent } from './outbox-bridge.ts'
import { OrderConflict, resolvePendingOrder } from './order-repository.ts'
import { resetDefaultServerState, supportedScenarios } from './reset-seed.ts'
import { announceMockReset } from '../shared/reset-signal.ts'
import { advanceMockClock, readMockClock, type MockNow } from './mock-clock.ts'
import { readJson } from './read-json.ts'

const updateFee = z.object({ action: z.literal('updateFee'), payload: z.object({ amount: moneySchema }) })
const updateNft = z.object({ action: z.literal('updateNft'), payload: z.object({ nftId: z.string().min(1), editionId: editionIdSchema, unitPrice: moneySchema.optional(), available: z.number().int().nonnegative().safe().optional() }).refine((value) => value.unitPrice !== undefined || value.available !== undefined) })
const expireCoupon = z.object({ action: z.literal('expireCoupon'), payload: z.object({ code: z.literal('KURIO10') }) })
const expireSession = z.object({ action: z.literal('expireSession'), payload: z.object({ sessionId: z.string().min(1) }) })
const resolveOrder = z.object({ action: z.literal('resolveOrder'), payload: z.object({ ownerUserId: z.string().min(1), orderId: z.string().min(1), outcome: z.enum(['confirmed', 'declined']) }) })
const disconnect = z.object({ action: z.literal('disconnect'), payload: z.object({}).optional() })
const walletConnectionBehavior = z.object({ action: z.literal('setWalletConnectionBehavior'), payload: z.object({ refuse: z.boolean() }) })
const cartReadFailure = z.object({ action: z.literal('setCartReadFailure'), payload: z.object({ enabled: z.boolean() }) })
const replayPayload = z.object({ eventId: z.string().min(1) })
const duplicate = z.object({ action: z.literal('emitDuplicate'), payload: replayPayload })
const older = z.object({ action: z.literal('emitOlder'), payload: replayPayload })
const actionSchema = z.discriminatedUnion('action', [updateFee, updateNft, expireCoupon, expireSession, resolveOrder, disconnect, walletConnectionBehavior, cartReadFailure, duplicate, older])
const failure = (status: number, code: string, message: string) => HttpResponse.json({ error: { code, message, retryable: false }, requestId: crypto.randomUUID() }, { status })

/** Technical controls are registered only by the mock worker. */
export function controlHandlers(database: IDBDatabase, now: MockNow = Date.now) {
  return [http.get('*/api/v1/__mock/state', async () => {
    const state = await new Promise<{ scenario: string; seed: number; generation: string | null; catalogCount: number }>((resolve, reject) => {
      const tx = database.transaction(['scenario', 'catalog'], 'readonly')
      const config = tx.objectStore('scenario').get('scenario-config')
      const generation = tx.objectStore('scenario').get('reset-generation')
      const count = tx.objectStore('catalog').count()
      tx.oncomplete = () => resolve({ scenario: config.result?.name ?? 'default', seed: config.result?.seed ?? 0, generation: generation.result?.generation ?? null, catalogCount: count.result })
      tx.onabort = () => reject(tx.error)
    })
    return HttpResponse.json({ ...state, clock: await readMockClock(database) })
  }), http.post('*/api/v1/__mock/reset', async ({ request }) => {
    const body = await readJson(request)
    if (!body.ok) return failure(400, 'MALFORMED_JSON', 'Requisição ilegível')
    const input = z.object({ scenario: z.enum(supportedScenarios), clockMode: z.enum(['real', 'manual']), seed: z.number().int().safe().optional() }).safeParse(body.value)
    if (!input.success) return failure(422, 'VALIDATION', 'Cenário ou relógio não disponível')
    const generation = await resetDefaultServerState(database, input.data.clockMode, input.data.scenario, input.data.seed)
    announceMockReset(generation)
    return HttpResponse.json({ scenario: input.data.scenario, clockMode: input.data.clockMode, generation })
  }), http.post('*/api/v1/__mock/clock', async ({ request }) => {
    const body = await readJson(request)
    if (!body.ok) return failure(400, 'MALFORMED_JSON', 'Requisição ilegível')
    const input = z.object({ advanceMs: z.number().int().nonnegative().safe() }).safeParse(body.value)
    if (!input.success) return failure(422, 'VALIDATION', 'Avanço de relógio inválido')
    try {
      const result = await advanceMockClock(database, input.data.advanceMs)
      notifyOutbox()
      return HttpResponse.json(result)
    } catch {
      return failure(409, 'CLOCK_UNAVAILABLE', 'Relógio manual indisponível')
    }
  }), http.post('*/api/v1/__mock/actions', async ({ request }) => {
    const body = await readJson(request)
    if (!body.ok) return failure(400, 'MALFORMED_JSON', 'Requisição ilegível')
    const parsed = actionSchema.safeParse(body.value)
    if (!parsed.success) return failure(422, 'VALIDATION', 'Ação ou valor inválido')
    if (parsed.data.action === 'setCartReadFailure') {
      const { enabled } = parsed.data.payload
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction('scenario', 'readwrite')
        tx.objectStore('scenario').put({ id: 'cart-read-failure', enabled })
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error)
      })
      return HttpResponse.json({ enabled })
    }
    if (parsed.data.action === 'setWalletConnectionBehavior') {
      const { refuse } = parsed.data.payload
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction('scenario', 'readwrite')
        tx.objectStore('scenario').put({ id: 'connection-behavior', refuse })
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error)
      })
      return HttpResponse.json({ refuse })
    }
    if (parsed.data.action === 'disconnect') {
      disconnectMockSockets()
      return HttpResponse.json({ disconnected: true })
    }
    if (parsed.data.action === 'emitDuplicate' || parsed.data.action === 'emitOlder') {
      const eventId = parsed.data.payload.eventId
      const event = await new Promise<{ version: number } | undefined>((resolve, reject) => {
        const tx = database.transaction('outbox')
        const request = tx.objectStore('outbox').get(eventId)
        tx.oncomplete = () => resolve(request.result)
        tx.onabort = () => reject(tx.error)
      })
      if (!event) return failure(404, 'EVENT_NOT_FOUND', 'Evento não encontrado')
      if (parsed.data.action === 'emitOlder' && event.version < 1) return failure(409, 'NO_OLDER_VERSION', 'Evento não possui versão anterior')
      const replacementId = parsed.data.action === 'emitOlder' ? crypto.randomUUID() : undefined
      replayMockEvent({ eventId: parsed.data.payload.eventId, replacementId })
      return HttpResponse.json({ eventId: replacementId ?? parsed.data.payload.eventId })
    }
    if (parsed.data.action === 'expireSession') {
      const { sessionId } = parsed.data.payload
      const found = await new Promise<boolean>((resolve, reject) => {
        const tx = database.transaction('sessions', 'readwrite')
        const store = tx.objectStore('sessions')
        const request = store.getAll()
        let changed = false
        request.onsuccess = () => {
          const session = request.result.find((item) => item.sessionId === sessionId)
          if (session) {
            store.put({ ...session, expiresAt: new Date(0).toISOString() })
            changed = true
          }
        }
        tx.oncomplete = () => resolve(changed)
        tx.onabort = () => reject(tx.error)
      })
      if (!found) return failure(404, 'SESSION_NOT_FOUND', 'Sessão não encontrada')
      notifyOutbox()
      return HttpResponse.json({ sessionId, expired: true })
    }
    if (parsed.data.action === 'resolveOrder') {
      const { orderId, ownerUserId, outcome } = parsed.data.payload
      try {
        const order = await resolvePendingOrder(database, ownerUserId, orderId, outcome, await now())
        notifyOutbox()
        return HttpResponse.json({ orderId: order.id, status: order.status, version: order.version })
      } catch (error) {
        if (error instanceof OrderConflict) return failure(error.code === 'ORDER_NOT_FOUND' ? 404 : 409, error.code, 'Pedido não pode ser alterado')
        return failure(500, 'ORDER_UNAVAILABLE', 'Não foi possível resolver o pedido')
      }
    }
    if (parsed.data.action === 'expireCoupon') {
      const result = await new Promise<{ code: string; expired: boolean; version: number }>((resolve, reject) => {
        const tx = database.transaction('scenario', 'readwrite')
        const store = tx.objectStore('scenario')
        const current = store.get('coupon:KURIO10')
        let next: { code: string; expired: boolean; version: number }
        current.onsuccess = () => {
          next = { code: 'KURIO10', expired: true, version: (current.result?.version ?? 1) + 1 }
          store.put({ id: 'coupon:KURIO10', ...next })
        }
        tx.oncomplete = () => resolve(next)
        tx.onabort = () => reject(tx.error)
      })
      return HttpResponse.json(result)
    }
    if (parsed.data.action === 'updateNft') {
      const input = parsed.data.payload
      const occurredAt = new Date(await now()).toISOString()
      const changed = await new Promise<NFT | undefined>((resolve, reject) => {
        const tx = database.transaction(['catalog', 'scenario', 'outbox'], 'readwrite')
        const catalog = tx.objectStore('catalog')
        const nftRequest = catalog.get(input.nftId)
        const metaRequest = tx.objectStore('scenario').get('catalog-meta')
        let count = 0
        let result: NFT | undefined
        const ready = () => {
          if (++count !== 2) return
          const nft = nftRequest.result as NFT | undefined
          const edition = nft?.editions.find((item) => item.id === input.editionId)
          if (!nft || !edition || !Number.isSafeInteger(metaRequest.result?.catalogVersion)) return
          if (input.unitPrice !== undefined) edition.unitPrice = input.unitPrice
          if (input.available !== undefined) edition.available = input.available
          edition.version++
          nft.version++
          const catalogVersion = metaRequest.result.catalogVersion + 1
          catalog.put(nft)
          tx.objectStore('scenario').put({ ...metaRequest.result, catalogVersion })
          const eventId = crypto.randomUUID()
          tx.objectStore('outbox').add({ id: eventId, eventId, type: 'nft.updated', resourceId: nft.id, version: nft.version, catalogVersion, occurredAt, payload: { nftId: nft.id, editions: nft.editions } })
          result = nft
        }
        nftRequest.onsuccess = ready
        metaRequest.onsuccess = ready
        tx.oncomplete = () => resolve(result)
        tx.onabort = () => reject(tx.error)
      })
      if (!changed) return failure(404, 'NFT_NOT_FOUND', 'NFT ou edição não encontrado')
      notifyOutbox()
      return HttpResponse.json(changed)
    }
    const amount = parsed.data.payload.amount
    const result = await new Promise<{ amount: string; version: number }>((resolve, reject) => {
      const tx = database.transaction('scenario', 'readwrite')
      const store = tx.objectStore('scenario')
      const current = store.get('network-fee')
      let next: { amount: string; version: number }
      current.onsuccess = () => {
        next = { amount, version: (current.result?.version ?? 0) + 1 }
        store.put({ id: 'network-fee', ...next })
      }
      tx.oncomplete = () => resolve(next)
      tx.onabort = () => reject(tx.error)
    })
    return HttpResponse.json(result)
  })]
}
