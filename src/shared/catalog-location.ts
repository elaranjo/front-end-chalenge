import type { CatalogParams } from './catalog-client.ts'
import { parseEth, formatEth } from './money.ts'

const sorts = ['recent', 'name-asc', 'name-desc', 'price-asc', 'price-desc'] as const
const tabs = ['all', 'new', 'trending'] as const
const networks = ['ethereum', 'polygon', 'solana'] as const

/** Normalize URL input without coupling application code to the mock catalog. */
export function parseCatalogLocation(params: URLSearchParams, categories: readonly string[]): CatalogParams {
  const q = params.get('q')?.trim()
  const category = [...new Set(params.getAll('category').filter((value) => categories.includes(value)))].sort()
  const network = [...new Set(params.getAll('network').filter((value) => (networks as readonly string[]).includes(value)))].sort()
  const rawSort = params.get('sort')
  const rawTab = params.get('tab')
  const rawPage = params.get('page')
  const page = rawPage && /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) ? Number(rawPage) : 1
  const amount = (key: string) => {
    const value = params.get(key)
    if (value === null) return undefined
    try { return formatEth(parseEth(value)) } catch { return undefined }
  }
  let min = amount('min')
  let max = amount('max')
  if (min !== undefined && max !== undefined && parseEth(min) > parseEth(max)) { min = undefined; max = undefined }
  return {
    ...(q ? { q } : {}), ...(category.length ? { category } : {}), ...(network.length ? { network } : {}),
    ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}),
    ...(rawSort && (sorts as readonly string[]).includes(rawSort) ? { sort: rawSort as NonNullable<CatalogParams['sort']> } : {}),
    ...(rawTab && (tabs as readonly string[]).includes(rawTab) ? { tab: rawTab as NonNullable<CatalogParams['tab']> } : {}), page,
  }
}

/** Search, filter, sort and tab changes always return to the first page. */
export function updateCatalogLocation(current: CatalogParams, patch: Partial<Omit<CatalogParams, 'page'>>): CatalogParams {
  return { ...current, ...patch, page: 1 }
}
