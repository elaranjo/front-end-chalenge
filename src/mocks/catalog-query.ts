import type { NFT } from '../shared/contracts.ts'
import { parseEth } from '../shared/money.ts'

export type CatalogSort = 'recent' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'
export type CatalogQuery = {
  q?: string
  category?: string[]
  network?: string[]
  min?: string
  max?: string
  sort?: CatalogSort
  page?: number
  tab?: 'all' | 'new' | 'trending'
}

const price = (item: NFT): bigint => {
  if (!item.editions.length) throw new Error('NFT without editions')
  return item.editions.reduce((lowest, edition) => {
    const amount = parseEth(edition.unitPrice)
    return amount < lowest ? amount : lowest
  }, parseEth(item.editions[0].unitPrice))
}

/** Called by the network handler using the current persisted catalog snapshot. */
export function queryCatalog(catalog: readonly NFT[], query: CatalogQuery, catalogVersion: number) {
  const page = query.page ?? 1
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(catalogVersion) || catalogVersion < 0) {
    throw new RangeError('Invalid page or catalog version')
  }
  const min = query.min === undefined ? undefined : parseEth(query.min)
  const max = query.max === undefined ? undefined : parseEth(query.max)
  if (min !== undefined && max !== undefined && min > max) throw new RangeError('Invalid price range')
  const text = (query.q ?? '').trim().toLocaleLowerCase('pt-BR')
  const facets = {
    categories: Object.fromEntries([...new Set(catalog.map((item) => item.category))].map((key) => [key, catalog.filter((item) => item.category === key).length])),
    networks: Object.fromEntries([...new Set(catalog.map((item) => item.network))].map((key) => [key, catalog.filter((item) => item.network === key).length])),
  }
  const filtered = catalog.filter((item) => {
    const amount = price(item)
    return (!text || `${item.name} ${item.tokenId} ${item.collection}`.toLocaleLowerCase('pt-BR').includes(text))
      && (!query.category?.length || query.category.includes(item.category))
      && (!query.network?.length || query.network.includes(item.network))
      && (min === undefined || amount >= min) && (max === undefined || amount <= max)
  })
  filtered.sort((a, b) => {
    let comparison = 0
    switch (query.sort) {
      case 'name-asc': comparison = a.name.localeCompare(b.name, 'pt-BR'); break
      case 'name-desc': comparison = b.name.localeCompare(a.name, 'pt-BR'); break
      case 'price-asc': comparison = price(a) < price(b) ? -1 : price(a) > price(b) ? 1 : 0; break
      case 'price-desc': comparison = price(a) > price(b) ? -1 : price(a) < price(b) ? 1 : 0; break
      case 'recent': comparison = b.createdAt.localeCompare(a.createdAt); break
      default: comparison = query.tab === 'trending' ? b.ratingCount - a.ratingCount : b.createdAt.localeCompare(a.createdAt)
    }
    return comparison || a.id.localeCompare(b.id)
  })
  const pageSize = 9
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize, hasNext: page * pageSize < filtered.length, catalogVersion, facets }
}
