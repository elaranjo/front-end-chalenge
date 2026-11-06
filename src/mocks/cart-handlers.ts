import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { editionIdSchema, networkSchema, providerSchema } from '../shared/contracts.ts'
import { CartConflict } from './cart-domain.ts'
import { claimVisualCart, mergeStoredCarts, mutateStoredCart, setCartCoupon } from './cart-repository.ts'
import { readSession } from './auth-handlers.ts'
import { readCartView, type CheckoutQuoteOptions } from './cart-view.ts'
import { readJson } from './read-json.ts'
import type { MockNow } from './mock-clock.ts'

const addSchema = z.object({ nftId: z.string().min(1), editionId: editionIdSchema, quantity: z.number().int().positive().safe() })
const quantitySchema = z.object({ quantity: z.number().int().positive().safe() })
const mergeSchema = z.object({ visitorId: z.string().min(1), mergeKey: z.string().min(1) })
const quoteRequestSchema = z.object({ cartRevision: z.number().int().nonnegative().safe(), walletId: z.string().min(1), network: networkSchema, provider: providerSchema })
const fail = (status: number, code: string, message: string) => HttpResponse.json({ error: { code, message, retryable: status >= 500 }, requestId: crypto.randomUUID() }, { status })

async function ownerOf(database: IDBDatabase, request: Request, now: MockNow) {
  const authorization = request.headers.get('Authorization')
  if (authorization) {
    const token = /^Bearer (\S+)$/.exec(authorization)?.[1]
    const session = token ? await readSession(database, token, await now()) : undefined
    return session ? { kind: 'user' as const, id: session.session.userId, token: session.session.id, sessionId: session.session.sessionId } : null
  }
  const visitor = request.headers.get('X-Visitor-Id')
  return visitor && visitor.length <= 128 ? { kind: 'visitor' as const, id: visitor } : null
}

function revisionOf(request: Request): number | undefined {
  const raw = request.headers.get('If-Match')
  if (raw === null || !/^(0|[1-9]\d*)$/.test(raw)) return undefined
  const revision = Number(raw)
  return Number.isSafeInteger(revision) ? revision : undefined
}

function mutationError(error: unknown) {
  if (error instanceof Error && error.message === 'SESSION_INVALID') return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
  if (error instanceof CartConflict) return fail(error.code === 'LINE_NOT_FOUND' ? 404 : 409, error.code, 'O carrinho ou o estoque mudou')
  if (error instanceof RangeError || error instanceof TypeError) return fail(422, 'VALIDATION', 'Verifique os dados do carrinho')
  if (error instanceof Error && ['COUPON_INVALID', 'COUPON_EXPIRED'].includes(error.message)) return fail(422, error.message, error.message === 'COUPON_EXPIRED' ? 'Cupom expirado' : 'Cupom inválido')
  if (error instanceof Error && error.message === 'REVISION_CONFLICT') return fail(409, error.message, 'O carrinho mudou')
  if (error instanceof Error && error.message === 'EDITION_UNAVAILABLE') return fail(409, error.message, 'Uma edição não está mais disponível')
  if (error instanceof Error && error.message === 'WALLET_NOT_FOUND') return fail(404, error.message, 'Carteira não encontrada')
  if (error instanceof Error && error.message === 'FORBIDDEN') return fail(403, error.message, 'Acesso não autorizado')
  if (error instanceof Error && ['NETWORK_MISMATCH', 'EMPTY_CART'].includes(error.message)) return fail(422, error.message, 'Verifique a carteira e o carrinho')
  if (error instanceof Error && ['IDEMPOTENCY_CONFLICT', 'VISITOR_ALREADY_CONSUMED'].includes(error.message)) return fail(409, error.message, 'Esta operação já foi utilizada')
  return fail(500, 'CART_UNAVAILABLE', 'Não foi possível atualizar o carrinho')
}

async function commitAuth(owner: NonNullable<Awaited<ReturnType<typeof ownerOf>>>, now: MockNow) {
  return owner.kind === 'user' ? { token: owner.token, sessionId: owner.sessionId, now: await now() } : undefined
}

export function cartHandlers(database: IDBDatabase, now: MockNow = Date.now) {
  async function view(owner: NonNullable<Awaited<ReturnType<typeof ownerOf>>>, checkout?: CheckoutQuoteOptions) {
    const auth = await commitAuth(owner, now)
    return readCartView(database, owner, auth?.now ?? await now(), checkout, auth)
  }
  return [
    http.get('*/api/v1/cart', async ({ request }) => {
      const owner = await ownerOf(database, request, now)
      if (!owner) return fail(401, 'SESSION_INVALID', 'Identificação inválida')
      try {
        await claimVisualCart(database, owner, await commitAuth(owner, now))
        return HttpResponse.json(await view(owner))
      } catch (error) { return mutationError(error) }
    }),
    http.post('*/api/v1/cart/items', async ({ request }) => {
      const owner = await ownerOf(database, request, now)
      if (!owner) return fail(401, 'SESSION_INVALID', 'Identificação inválida')
      const revision = revisionOf(request)
      const mutationId = request.headers.get('X-Mutation-Id')
      if (revision === undefined || !mutationId) return fail(400, 'MISSING_PRECONDITION', 'Revisão e identificação da operação são obrigatórias')
      const raw = await readJson(request)
      if (!raw.ok) return fail(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const body = addSchema.safeParse(raw.value)
      if (!body.success) return fail(422, 'VALIDATION', 'Verifique os dados do item')
      try {
        await mutateStoredCart(database, owner, { kind: 'add', ...body.data, revision, mutationId }, await commitAuth(owner, now))
        return HttpResponse.json(await view(owner))
      } catch (error) { return mutationError(error) }
    }),
    http.patch('*/api/v1/cart/items/:lineId', async ({ request, params }) => {
      const owner = await ownerOf(database, request, now)
      if (!owner) return fail(401, 'SESSION_INVALID', 'Identificação inválida')
      const revision = revisionOf(request)
      if (revision === undefined) return fail(400, 'MISSING_PRECONDITION', 'Revisão obrigatória')
      const raw = await readJson(request)
      if (!raw.ok) return fail(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const body = quantitySchema.safeParse(raw.value)
      if (!body.success || typeof params.lineId !== 'string') return fail(422, 'VALIDATION', 'Verifique a quantidade')
      try {
        await mutateStoredCart(database, owner, { kind: 'change', lineId: params.lineId, quantity: body.data.quantity, revision }, await commitAuth(owner, now))
        return HttpResponse.json(await view(owner))
      } catch (error) { return mutationError(error) }
    }),
    http.delete('*/api/v1/cart/items/:lineId', async ({ request, params }) => {
      const owner = await ownerOf(database, request, now)
      if (!owner) return fail(401, 'SESSION_INVALID', 'Identificação inválida')
      const revision = revisionOf(request)
      if (revision === undefined || typeof params.lineId !== 'string') return fail(400, 'MISSING_PRECONDITION', 'Revisão obrigatória')
      try {
        await mutateStoredCart(database, owner, { kind: 'remove', lineId: params.lineId, revision }, await commitAuth(owner, now))
        return HttpResponse.json(await view(owner))
      } catch (error) { return mutationError(error) }
    }),
    http.put('*/api/v1/cart/coupon', async ({ request }) => {
      const owner = await ownerOf(database, request, now)
      if (!owner) return fail(401, 'SESSION_INVALID', 'Identificação inválida')
      const revision = revisionOf(request)
      if (revision === undefined) return fail(400, 'MISSING_PRECONDITION', 'Revisão obrigatória')
      const raw = await readJson(request)
      if (!raw.ok) return fail(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const body = z.object({ code: z.string().trim().min(1) }).safeParse(raw.value)
      if (!body.success) return fail(422, 'VALIDATION', 'Informe o cupom')
      try {
        await setCartCoupon(database, owner, body.data.code, revision, await commitAuth(owner, now))
        return HttpResponse.json(await view(owner))
      } catch (error) { return mutationError(error) }
    }),
    http.delete('*/api/v1/cart/coupon', async ({ request }) => {
      const owner = await ownerOf(database, request, now)
      if (!owner) return fail(401, 'SESSION_INVALID', 'Identificação inválida')
      const revision = revisionOf(request)
      if (revision === undefined) return fail(400, 'MISSING_PRECONDITION', 'Revisão obrigatória')
      try {
        await setCartCoupon(database, owner, null, revision, await commitAuth(owner, now))
        return HttpResponse.json(await view(owner))
      } catch (error) { return mutationError(error) }
    }),
    http.post('*/api/v1/cart/merge', async ({ request }) => {
      const owner = await ownerOf(database, request, now)
      if (!owner || owner.kind !== 'user') return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      const raw = await readJson(request)
      if (!raw.ok) return fail(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const body = mergeSchema.safeParse(raw.value)
      if (!body.success) return fail(422, 'VALIDATION', 'Identificação do visitante obrigatória')
      try {
        const { adjustments } = await mergeStoredCarts(database, owner.id, body.data.visitorId, body.data.mergeKey, await commitAuth(owner, now))
        return HttpResponse.json({ cart: await view(owner), adjustments })
      } catch (error) { return mutationError(error) }
    }),
    http.post('*/api/v1/quotes', async ({ request }) => {
      const owner = await ownerOf(database, request, now)
      if (!owner || owner.kind !== 'user') return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      const raw = await readJson(request)
      if (!raw.ok) return fail(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const input = quoteRequestSchema.safeParse(raw.value)
      if (!input.success) return fail(422, 'VALIDATION', 'Verifique a carteira, rede e revisão')
      try {
        const serverTime = await now()
        const auth = { token: owner.token, sessionId: owner.sessionId, now: serverTime }
        const quote = (await readCartView(database, owner, serverTime, input.data, auth)).quote
        return HttpResponse.json(quote, { headers: { 'X-Server-Time': new Date(serverTime).toISOString() } })
      } catch (error) { return mutationError(error) }
    }),
  ]
}
