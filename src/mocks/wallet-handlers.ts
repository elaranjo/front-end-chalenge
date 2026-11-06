import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { readJson } from './read-json.ts'
import { networkSchema, providerSchema } from '../shared/contracts.ts'
import { readSession } from './auth-handlers.ts'
import type { MockNow } from './mock-clock.ts'

const required = z.string().trim().min(1)
const walletInput = z.object({
  displayName: required, nickname: required, network: networkSchema, profileName: required,
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), secondaryAddress: z.string().optional(),
  type: providerSchema, referralCode: required, email: z.email(), ensName: required.regex(/^[a-zA-Z0-9-]+$/),
})
const fail = (status: number, code: string, message: string, fields?: Record<string, string>) => HttpResponse.json({ error: { code, message, retryable: false, ...(fields ? { fieldErrors: fields } : {}) }, requestId: crypto.randomUUID() }, { status })
async function authenticate(database: IDBDatabase, request: Request, now: MockNow) {
  const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1]
  return token ? readSession(database, token, await now()) : undefined
}

export function walletHandlers(database: IDBDatabase, now: MockNow = Date.now) {
  return [
    http.get('*/api/v1/wallets', async ({ request }) => {
      const session = await authenticate(database, request, now)
      if (!session) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      const readTime = await now()
      const result = await new Promise<{ items: unknown[]; version: number } | null>((resolve, reject) => {
        const tx = database.transaction(['wallets', 'scenario', 'sessions'], 'readonly')
        const result = tx.objectStore('wallets').getAll()
        const meta = tx.objectStore('scenario').get(`wallets:${session.session.userId}`)
        const current = tx.objectStore('sessions').get(session.session.id)
        tx.oncomplete = () => resolve(!current.result || current.result.userId !== session.session.userId || current.result.sessionId !== session.session.sessionId || Date.parse(current.result.expiresAt) <= readTime ? null : { items: result.result.filter((item) => item.ownerUserId === session.session.userId).map(({ ownerUserId: _owner, ...wallet }) => wallet), version: meta.result?.version ?? 0 })
        tx.onabort = () => reject(tx.error)
      })
      return result ? HttpResponse.json(result) : fail(401, 'SESSION_INVALID', 'Autenticação necessária')
    }),
    http.put('*/api/v1/wallets/:slot', async ({ request, params }) => {
      const session = await authenticate(database, request, now)
      if (!session) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      if (params.slot !== 'primary' && params.slot !== 'secondary') return fail(404, 'SLOT_NOT_FOUND', 'Carteira não encontrada')
      const revision = request.headers.get('If-Match')
      if (revision === null || !/^(0|[1-9]\d*)$/.test(revision) || !Number.isSafeInteger(Number(revision))) return fail(400, 'MISSING_PRECONDITION', 'Revisão obrigatória')
      const body = await readJson(request)
      if (!body.ok) return fail(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const parsed = walletInput.safeParse(body.value)
      if (!parsed.success) return fail(422, 'VALIDATION', 'Verifique os campos', Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      const slot = params.slot
      const userId = session.session.userId
      const commitTime = await now()
      const outcome = await new Promise<{ conflict: boolean; unauthorized?: boolean; wallet?: z.infer<typeof walletInput> & { id: string; slot: string; version: number } }>((resolve, reject) => {
        const tx = database.transaction(['wallets', 'scenario', 'sessions'], 'readwrite')
        const store = tx.objectStore('wallets')
        const id = `${userId}:${slot}`
        const existing = store.get(id)
        const meta = tx.objectStore('scenario').get(`wallets:${userId}`)
        const connection = tx.objectStore('scenario').get(`connection:${userId}`)
        const currentSession = tx.objectStore('sessions').get(session.session.id)
        let result: { conflict: boolean; unauthorized?: boolean; wallet?: z.infer<typeof walletInput> & { id: string; slot: string; version: number } }
        let reads = 0
        const ready = () => {
          if (++reads !== 4) return
          if (!currentSession.result || currentSession.result.userId !== userId || Date.parse(currentSession.result.expiresAt) <= commitTime) { result = { conflict: false, unauthorized: true }; return }
          const currentVersion = existing.result?.version ?? 0
          if (currentVersion !== Number(revision)) { result = { conflict: true }; return }
          const wallet = { id, slot, ...parsed.data, version: currentVersion + 1 }
          store.put({ ...wallet, ownerUserId: userId })
          tx.objectStore('scenario').put({ id: `wallets:${userId}`, version: (meta.result?.version ?? 0) + 1 })
          if (connection.result?.walletId === id && connection.result.status === 'connected') tx.objectStore('scenario').put({ ...connection.result, status: 'disconnected', version: connection.result.version + 1 })
          result = { conflict: false, wallet }
        }
        existing.onsuccess = ready
        meta.onsuccess = ready
        connection.onsuccess = ready
        currentSession.onsuccess = ready
        tx.oncomplete = () => resolve(result)
        tx.onabort = () => reject(tx.error)
      })
      if (outcome.unauthorized) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      return outcome.conflict ? fail(409, 'REVISION_CONFLICT', 'Carteira alterada; recarregue os dados') : HttpResponse.json(outcome.wallet)
    }),
    http.post('*/api/v1/wallet-connections', async ({ request }) => {
      const session = await authenticate(database, request, now)
      if (!session) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      const body = await readJson(request)
      if (!body.ok) return fail(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const input = z.object({ walletId: required, provider: providerSchema, network: networkSchema }).safeParse(body.value)
      if (!input.success) return fail(422, 'VALIDATION', 'Selecione uma carteira e uma rede válidas')
      const userId = session.session.userId
      const commitTime = await now()
      const result = await new Promise<{ status: 'missing' | 'forbidden' | 'mismatch' | 'unauthorized' } | { id: string; status: 'connected' | 'refused'; walletId: string; provider: string; network: string; version: number }>((resolve, reject) => {
        const tx = database.transaction(['wallets', 'scenario', 'sessions'], 'readwrite')
        const wallet = tx.objectStore('wallets').get(input.data.walletId)
        const scenario = tx.objectStore('scenario')
        const current = scenario.get(`connection:${userId}`)
        const behavior = scenario.get('connection-behavior')
        const currentSession = tx.objectStore('sessions').get(session.session.id)
        let reads = 0
        let result: { status: 'missing' | 'forbidden' | 'mismatch' | 'unauthorized' } | { id: string; status: 'connected' | 'refused'; walletId: string; provider: string; network: string; version: number }
        const ready = () => {
          if (++reads !== 4) return
          if (!currentSession.result || currentSession.result.userId !== userId || Date.parse(currentSession.result.expiresAt) <= commitTime) { result = { status: 'unauthorized' }; return }
          if (!wallet.result) { result = { status: 'missing' }; return }
          if (wallet.result.ownerUserId !== userId) { result = { status: 'forbidden' }; return }
          if (wallet.result.network !== input.data.network) { result = { status: 'mismatch' }; return }
          const prior = current.result
          if (prior?.status === 'connected' && prior.sessionId === session.session.sessionId && prior.walletId === input.data.walletId && prior.provider === input.data.provider && prior.network === input.data.network) {
            const { ownerUserId: _owner, sessionId: _sessionId, id: _key, connectionId, ...fields } = prior
            result = { ...fields, id: connectionId }
            return
          }
          const connection = { id: crypto.randomUUID(), status: behavior.result?.refuse ? 'refused' as const : 'connected' as const, ...input.data, version: (prior?.version ?? 0) + 1 }
          scenario.put({ ...connection, id: `connection:${userId}`, connectionId: connection.id, ownerUserId: userId, sessionId: session.session.sessionId })
          result = connection
        }
        wallet.onsuccess = ready
        current.onsuccess = ready
        behavior.onsuccess = ready
        currentSession.onsuccess = ready
        tx.oncomplete = () => resolve(result)
        tx.onabort = () => reject(tx.error)
      })
      if (result.status === 'missing') return fail(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada')
      if (result.status === 'unauthorized') return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      if (result.status === 'forbidden') return fail(403, 'FORBIDDEN', 'Acesso não autorizado')
      if (result.status === 'mismatch') return fail(422, 'NETWORK_MISMATCH', 'A rede não corresponde à carteira')
      return HttpResponse.json(result)
    }),
    http.delete('*/api/v1/wallet-connections/:id', async ({ request, params }) => {
      const session = await authenticate(database, request, now)
      if (!session) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      const commitTime = await now()
      const found = await new Promise<'ok' | 'forbidden' | 'missing' | 'unauthorized'>((resolve, reject) => {
        const tx = database.transaction(['scenario', 'sessions'], 'readwrite')
        const store = tx.objectStore('scenario')
        const all = store.getAll()
        const currentSession = tx.objectStore('sessions').get(session.session.id)
        let result: 'ok' | 'forbidden' | 'missing' | 'unauthorized' = 'missing'
        let reads = 0
        const ready = () => {
          if (++reads !== 2) return
          if (!currentSession.result || currentSession.result.userId !== session.session.userId || Date.parse(currentSession.result.expiresAt) <= commitTime) { result = 'unauthorized'; return }
          const current = all.result.find((item) => item.connectionId === params.id)
          if (current && (current.ownerUserId !== session.session.userId || current.sessionId !== session.session.sessionId)) result = 'forbidden'
          else if (current) {
            result = 'ok'
            store.put({ ...current, status: 'disconnected', version: current.version + 1 })
          }
        }
        all.onsuccess = ready
        currentSession.onsuccess = ready
        tx.oncomplete = () => resolve(result)
        tx.onabort = () => reject(tx.error)
      })
      if (found === 'unauthorized') return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      if (found === 'forbidden') return fail(403, 'FORBIDDEN', 'Acesso não autorizado')
      return found === 'ok' ? new HttpResponse(null, { status: 204 }) : fail(404, 'CONNECTION_NOT_FOUND', 'Conexão não encontrada')
    }),
  ]
}
