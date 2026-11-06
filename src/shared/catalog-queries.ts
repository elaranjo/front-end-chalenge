import type { AxiosInstance } from 'axios'
import { queryOptions } from '@tanstack/react-query'
import type { EventGate } from '../realtime/event-gate.ts'
import { catalogSearchParams, fetchCatalog, fetchNft, StaleCatalogResponse, type CatalogParams } from './catalog-client.ts'

/** Query identity includes all normalized search parameters. */
export function catalogQueries(http: AxiosInstance, getGate: () => EventGate | null) {
  const gateForRequest = () => {
    const gate = getGate()
    if (!gate) throw new StaleCatalogResponse()
    return gate
  }
  return {
    list: (params: CatalogParams) => {
      const canonical = catalogSearchParams(params).toString()
      const frozen = structuredClone(params)
      return queryOptions({ queryKey: ['catalog', canonical] as const, queryFn: async ({ signal }) => {
        const gate = gateForRequest()
        const result = await fetchCatalog(http, frozen, gate, signal)
        if (getGate() !== gate) throw new StaleCatalogResponse()
        return result
      } })
    },
    detail: (id: string) => queryOptions({ queryKey: ['nft', id] as const, queryFn: async ({ signal }) => {
      const gate = gateForRequest()
      const result = await fetchNft(http, id, gate, signal)
      if (getGate() !== gate) throw new StaleCatalogResponse()
      return result
    } }),
  }
}
