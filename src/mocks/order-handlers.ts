import { http, HttpResponse } from 'msw'
import { orderInputSchema } from '../shared/contracts.ts'
import { readSession } from './auth-handlers.ts'
import { createPendingOrder, findOrder, OrderConflict, type StoredOrder } from './order-repository.ts'
import { notifyOutbox } from './outbox-bridge.ts'
import { readJson } from './read-json.ts'
import type { MockNow } from './mock-clock.ts'

const failure = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) => HttpResponse.json({ error: { code, message, retryable: status >= 500, ...(fieldErrors ? { fieldErrors } : {}) }, requestId: crypto.randomUUID() }, { status })
const publicOrder = ({ resolveAt: _resolveAt, intendedOutcome: _intendedOutcome, ...order }: StoredOrder) => order
async function scenarioName(database: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('scenario', 'readonly')
    const request = tx.objectStore('scenario').get('scenario-config')
    tx.oncomplete = () => resolve(request.result?.name ?? 'default')
    tx.onabort = () => reject(tx.error)
  })
}
function waitForTimeout(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return }
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
    const timer = setTimeout(done, 11_000)
    ;(timer as unknown as { unref?: () => void }).unref?.()
    signal.addEventListener('abort', done, { once: true })
  })
}

export function orderHandlers(database: IDBDatabase, now: MockNow = Date.now) {
  async function ownerOf(request: Request) {
    const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1]
    return token ? (await readSession(database, token, await now()))?.session : undefined
  }
  return [
    http.post('*/api/v1/orders', async ({ request }) => {
      const owner = await ownerOf(request)
      if (!owner) return failure(401, 'SESSION_INVALID', 'Autenticação necessária')
      const key = request.headers.get('Idempotency-Key')
      if (!key || key.length > 128) return failure(400, 'IDEMPOTENCY_REQUIRED', 'Identificação da tentativa obrigatória')
      const body = await readJson(request)
      if (!body.ok) return failure(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const parsed = orderInputSchema.safeParse(body.value)
      if (!parsed.success) return failure(422, 'VALIDATION', 'Verifique os dados', Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])))
      if (parsed.data.collector.network !== parsed.data.network) return failure(422, 'NETWORK_MISMATCH', 'Verifique a rede selecionada')
      try {
        const scenario = await scenarioName(database)
        const result = await createPendingOrder(database, owner.userId, key, parsed.data, await now(), { token: owner.id, sessionId: owner.sessionId })
        if (result.created) notifyOutbox()
        if (result.created && scenario === 'timeout-after-order-create') await waitForTimeout(request.signal)
        return HttpResponse.json(publicOrder(result.order), { status: result.created ? 201 : 200 })
      } catch (error) {
        if (error instanceof OrderConflict) return failure(error.code === 'SESSION_INVALID' ? 401 : 409, error.code, 'Revise os dados da compra')
        return failure(500, 'ORDER_UNAVAILABLE', 'Não foi possível criar o pedido')
      }
    }),
    http.get('*/api/v1/orders/attempts/:key', async ({ request, params }) => {
      const owner = await ownerOf(request)
      if (!owner) return failure(401, 'SESSION_INVALID', 'Autenticação necessária')
      try {
        const order = typeof params.key === 'string' ? await findOrder(database, owner.userId, { key: params.key }, await now(), { token: owner.id, sessionId: owner.sessionId }) : undefined
        if (order && order.status !== 'pending') notifyOutbox()
        return order ? HttpResponse.json(publicOrder(order)) : failure(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado')
      } catch (error) {
        if (error instanceof OrderConflict && error.code === 'SESSION_INVALID') return failure(401, error.code, 'Autenticação necessária')
        return failure(500, 'ORDER_UNAVAILABLE', 'Não foi possível carregar o pedido')
      }
    }),
    http.get('*/api/v1/orders/:id', async ({ request, params }) => {
      const owner = await ownerOf(request)
      if (!owner) return failure(401, 'SESSION_INVALID', 'Autenticação necessária')
      try {
        const order = typeof params.id === 'string' ? await findOrder(database, owner.userId, { orderId: params.id }, await now(), { token: owner.id, sessionId: owner.sessionId }) : undefined
        if (order && order.status !== 'pending') notifyOutbox()
        return order ? HttpResponse.json(publicOrder(order)) : failure(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado')
      } catch (error) {
        if (error instanceof OrderConflict && error.code === 'FORBIDDEN') return failure(403, 'FORBIDDEN', 'Acesso não autorizado')
        if (error instanceof OrderConflict && error.code === 'SESSION_INVALID') return failure(401, error.code, 'Autenticação necessária')
        return failure(500, 'ORDER_UNAVAILABLE', 'Não foi possível carregar o pedido')
      }
    }),
  ]
}
