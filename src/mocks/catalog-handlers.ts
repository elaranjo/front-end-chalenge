import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { queryCatalog } from './catalog-query.ts'
import { createCatalogSeed } from './catalog-seed.ts'
import { openMockDatabase } from './database.ts'
import { nftSchema } from '../shared/contracts.ts'

const querySchema = z.object({
  q: z.string().optional(), category: z.array(z.string()), network: z.array(z.string()),
  min: z.string().optional(), max: z.string().optional(),
  sort: z.enum(['recent', 'name-asc', 'name-desc', 'price-asc', 'price-desc']).optional(),
  page: z.coerce.number().int().positive().safe().default(1),
  tab: z.enum(['all', 'new', 'trending']).optional(),
})

/** Initialize once in an atomic transaction so another tab cannot replace existing changes. */
export async function initializeCatalog(database: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['catalog', 'scenario'], 'readwrite')
    const scenario = tx.objectStore('scenario')
    const request = scenario.get('catalog-meta')
    request.onsuccess = () => {
      if (!request.result) {
        for (const item of createCatalogSeed()) tx.objectStore('catalog').add(item)
        scenario.add({ id: 'catalog-meta', catalogVersion: 1 })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('Catalog initialization failed'))
  })
}

async function readCatalog(database: IDBDatabase) {
  return new Promise<{ items: z.infer<typeof nftSchema>[]; catalogVersion: number }>((resolve, reject) => {
    const tx = database.transaction(['catalog', 'scenario'], 'readonly')
    const items = tx.objectStore('catalog').getAll()
    const meta = tx.objectStore('scenario').get('catalog-meta')
    tx.oncomplete = () => {
      const validated = z.array(nftSchema).safeParse(items.result)
      if (!validated.success || !Number.isSafeInteger(meta.result?.catalogVersion)) {
        reject(new Error('Invalid persisted catalog'))
      } else {
        resolve({ items: validated.data, catalogVersion: meta.result.catalogVersion })
      }
    }
    tx.onabort = () => reject(tx.error ?? new Error('Catalog read failed'))
  })
}

function failure(status: number, code: string, message: string, retryable = false) {
  return HttpResponse.json({ error: { code, message, retryable }, requestId: crypto.randomUUID() }, { status })
}

/** Dependency injection allows an isolated database in network-level tests. */
export function catalogHandlers(database: IDBDatabase) {
  return [
    http.get('*/api/v1/nfts', async ({ request }) => {
      const params = new URL(request.url).searchParams
      const query = querySchema.safeParse({
        q: params.get('q') ?? undefined, category: params.getAll('category'), network: params.getAll('network'),
        min: params.get('min') ?? undefined, max: params.get('max') ?? undefined,
        sort: params.get('sort') ?? undefined, page: params.get('page') ?? undefined, tab: params.get('tab') ?? undefined,
      })
      if (!query.success) return failure(400, 'INVALID_QUERY', 'Parâmetros de busca inválidos')
      try {
        const catalog = await readCatalog(database)
        return HttpResponse.json(queryCatalog(catalog.items, query.data, catalog.catalogVersion))
      } catch (error) {
        if (error instanceof RangeError) return failure(400, 'INVALID_QUERY', 'Faixa de preço inválida')
        return failure(500, 'CATALOG_UNAVAILABLE', 'Não foi possível carregar o catálogo', true)
      }
    }),
    http.get('*/api/v1/nfts/:id', async ({ params }) => {
      try {
        const catalog = await readCatalog(database)
        const item = catalog.items.find((entry) => entry.id === params.id)
        return item ? HttpResponse.json(item, { headers: { 'X-Catalog-Version': String(catalog.catalogVersion) } }) : failure(404, 'NFT_NOT_FOUND', 'NFT não encontrado')
      } catch {
        return failure(500, 'CATALOG_UNAVAILABLE', 'Não foi possível carregar o NFT', true)
      }
    }),
  ]
}

export async function openCatalog(): Promise<IDBDatabase> {
  const database = await openMockDatabase()
  try {
    await initializeCatalog(database)
    return database
  } catch (error) {
    database.close()
    throw error
  }
}
