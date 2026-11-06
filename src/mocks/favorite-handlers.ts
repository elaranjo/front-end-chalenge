import { http, HttpResponse } from 'msw'
import { readSession } from './auth-handlers.ts'
import type { NFT } from '../shared/contracts.ts'
import type { MockNow } from './mock-clock.ts'

type Favorites = { id: string; nftIds: string[]; version: number }
const failure = (status: number, code: string, message: string) => HttpResponse.json({ error: { code, message, retryable: false }, requestId: crypto.randomUUID() }, { status })
const tokenFor = (request: Request) => /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? ''

export function favoriteHandlers(database: IDBDatabase, now: MockNow = Date.now) {
  async function list(request: Request) {
    const session = await readSession(database, tokenFor(request), await now())
    if (!session) return failure(401, 'SESSION_INVALID', 'Autenticação necessária')
    const readTime = await now()
    const result = await new Promise<{ items: NFT[]; version: number } | null>((resolve, reject) => {
      const tx = database.transaction(['favorites', 'catalog', 'sessions'], 'readonly')
      const favorites = tx.objectStore('favorites').get(session.session.userId)
      const catalog = tx.objectStore('catalog').getAll()
      const current = tx.objectStore('sessions').get(session.session.id)
      tx.oncomplete = () => {
        if (!current.result || current.result.userId !== session.session.userId || current.result.sessionId !== session.session.sessionId || Date.parse(current.result.expiresAt) <= readTime) { resolve(null); return }
        const record = favorites.result as Favorites | undefined
        const ids = new Set(record?.nftIds ?? [])
        resolve({ items: (catalog.result as NFT[]).filter((nft) => ids.has(nft.id)), version: record?.version ?? 0 })
      }
      tx.onabort = () => reject(tx.error)
    })
    return result ? HttpResponse.json(result) : failure(401, 'SESSION_INVALID', 'Autenticação necessária')
  }
  async function mutate(request: Request, nftId: string, add: boolean) {
    const token = tokenFor(request)
    const session = await readSession(database, token, await now())
    if (!session) return failure(401, 'SESSION_INVALID', 'Autenticação necessária')
    const userId = session.session.userId
    const commitTime = await now()
    const result = await new Promise<{ status: 'ok'; favorite: boolean; version: number } | { status: 'missing' | 'unauthorized' }>((resolve, reject) => {
      const tx = database.transaction(['favorites', 'catalog', 'sessions'], 'readwrite')
      const favorites = tx.objectStore('favorites')
      const current = favorites.get(userId)
      const nft = tx.objectStore('catalog').get(nftId)
      const storedSession = tx.objectStore('sessions').get(token)
      let outcome: { status: 'ok'; favorite: boolean; version: number } | { status: 'missing' | 'unauthorized' } = { status: 'missing' }
      let reads = 0
      const ready = () => {
        if (++reads !== 3) return
        if (!storedSession.result || storedSession.result.userId !== userId || Date.parse(storedSession.result.expiresAt) <= commitTime) { outcome = { status: 'unauthorized' }; return }
        if (!nft.result) return
        const record: Favorites = current.result ?? { id: userId, nftIds: [], version: 0 }
        const present = record.nftIds.includes(nftId)
        if (present !== add) {
          record.nftIds = add ? [...record.nftIds, nftId] : record.nftIds.filter((id) => id !== nftId)
          record.version++
          favorites.put(record)
        }
        outcome = { status: 'ok', favorite: add, version: record.version }
      }
      current.onsuccess = ready
      nft.onsuccess = ready
      storedSession.onsuccess = ready
      tx.oncomplete = () => resolve(outcome)
      tx.onabort = () => reject(tx.error)
    })
    if (result.status === 'unauthorized') return failure(401, 'SESSION_INVALID', 'Autenticação necessária')
    if (result.status !== 'ok') return failure(404, 'NFT_NOT_FOUND', 'NFT não encontrado')
    return HttpResponse.json({ nftId, favorite: result.favorite, version: result.version })
  }
  return [
    http.get('*/api/v1/favorites', ({ request }) => list(request)),
    http.put('*/api/v1/favorites/:nftId', ({ request, params }) => mutate(request, String(params.nftId), true)),
    http.delete('*/api/v1/favorites/:nftId', ({ request, params }) => mutate(request, String(params.nftId), false)),
  ]
}
