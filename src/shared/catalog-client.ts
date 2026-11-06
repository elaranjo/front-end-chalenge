import type { AxiosInstance } from 'axios'
import { catalogPageSchema, nftSchema } from './contracts.ts'
import type { EventGate } from '../realtime/event-gate.ts'

export type CatalogParams = {
  q?: string; category?: string[]; network?: string[]; min?: string; max?: string
  sort?: 'recent' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'
  page?: number; tab?: 'all' | 'new' | 'trending'
}

export function catalogSearchParams(input: CatalogParams): URLSearchParams {
  const result = new URLSearchParams()
  if (input.q?.trim()) result.set('q', input.q.trim())
  for (const category of [...new Set(input.category ?? [])].sort()) result.append('category', category)
  for (const network of [...new Set(input.network ?? [])].sort()) result.append('network', network)
  for (const key of ['min', 'max', 'sort', 'tab'] as const) if (input[key] !== undefined) result.set(key, input[key])
  if (input.page !== undefined) result.set('page', String(input.page))
  return result
}

export class StaleCatalogResponse extends Error {
  constructor() { super('Catalog response is older than the current event watermark'); this.name = 'StaleCatalogResponse' }
}

export async function fetchCatalog(http: AxiosInstance, input: CatalogParams, gate: EventGate, signal?: AbortSignal) {
  const response = await http.get('/nfts', { params: catalogSearchParams(input), signal })
  const page = catalogPageSchema.parse(response.data)
  if (!gate.observeCatalog(page.catalogVersion)) throw new StaleCatalogResponse()
  return page
}

export async function fetchNft(http: AxiosInstance, id: string, gate: EventGate, signal?: AbortSignal) {
  const response = await http.get(`/nfts/${encodeURIComponent(id)}`, { signal })
  const nft = nftSchema.parse(response.data)
  const rawVersion = response.headers['x-catalog-version']
  if (typeof rawVersion !== 'string' || !/^(0|[1-9]\d*)$/.test(rawVersion) || !Number.isSafeInteger(Number(rawVersion)) || nft.id !== id) throw new Error('Invalid NFT response metadata')
  const catalogVersion = Number(rawVersion)
  if (!gate.observeNft(nft.id, nft.version, catalogVersion)) throw new StaleCatalogResponse()
  return nft
}
