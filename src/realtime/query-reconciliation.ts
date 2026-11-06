import type { Query, QueryClient } from '@tanstack/react-query'
import type { RealtimeEvent } from './event-gate.ts'
import type { RealtimeResources } from './synchronizer.ts'

/** Query keys begin with resource name; private keys also include owner and generation. */
function matches(query: Query, resources: RealtimeResources, ownerId: string | null) {
  const [resource, id, owner] = query.queryKey
  if (query.meta?.private === true && query.meta?.ownerId !== ownerId) return false
  if (resource === 'catalog') return resources.catalog
  if (resource === 'nft') return typeof id === 'string' && resources.nftIds.includes(id)
  if (resource === 'cart' || resource === 'quote') return ownerId !== null ? query.meta?.private === true && query.meta?.ownerId === ownerId : query.meta?.visitor === true && query.meta?.private !== true
  if (resource === 'profile' || resource === 'wallets' || resource === 'favorites') return ownerId !== null && query.meta?.private === true && query.meta?.ownerId === ownerId
  if (resource === 'order') return typeof id === 'string' && resources.orderIds.includes(id) && owner === ownerId
  return false
}

export function createQueryReconciliation(queries: QueryClient, ownerId: string | null) {
  return {
    async reconcile(resources: RealtimeResources) {
      await queries.invalidateQueries({ predicate: (query) => matches(query, resources, ownerId), refetchType: 'active' }, { throwOnError: true })
    },
    async refresh(event: RealtimeEvent) {
      await queries.invalidateQueries({
        predicate: (query) => {
          if (query.meta?.private === true && query.meta?.ownerId !== ownerId) return false
          const [resource, id, owner] = query.queryKey
          if (event.type === 'nft.updated') {
            const cartOwned = (resource === 'cart' || resource === 'quote') && (ownerId === null ? query.meta?.visitor === true && query.meta?.private !== true : query.meta?.private === true && query.meta?.ownerId === ownerId)
            const favoritesOwned = resource === 'favorites' && ownerId !== null && query.meta?.private === true && query.meta?.ownerId === ownerId
            return resource === 'catalog' || cartOwned || favoritesOwned || (resource === 'nft' && id === event.resourceId)
          }
          return resource === 'order' && id === event.resourceId && owner === ownerId
        },
        refetchType: 'active',
      }, { throwOnError: true })
    },
  }
}
