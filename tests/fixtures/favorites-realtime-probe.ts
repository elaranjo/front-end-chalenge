import { QueryObserver } from '@tanstack/react-query'
import { favorites } from '../../src/app/favorites.ts'
import { queryClient } from '../../src/app/query-client.ts'
import { realtime } from '../../src/app/realtime.ts'
import { sessionManager } from '../../src/app/session.ts'
import { api } from '../../src/shared/http.ts'

async function waitFor(label: string, predicate: () => boolean) {
  const deadline = Date.now() + 8000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for realtime favorites: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

export async function runFavoritesRealtimeProbe() {
  await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
  await waitFor('initial connection', () => realtime.isReady)
  const token = sessionManager.session!.token
  await api.put('/favorites/emerald-ape-042', undefined, { headers: { Authorization: `Bearer ${token}` } })
  // The direct network setup bypasses FavoritesClient.set, which normally invalidates
  // this cache. The home page may already have fetched the empty list after login.
  await queryClient.invalidateQueries({ queryKey: favorites.listQuery().queryKey, exact: true, refetchType: 'none' })
  const observer = new QueryObserver(queryClient, favorites.listQuery())
  const unsubscribe = observer.subscribe(() => {})
  try {
    await waitFor('initial favorites query', () => observer.getCurrentResult().data?.items.length === 1)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await waitFor('connection before update', () => realtime.isReady)
    await api.post('/__mock/actions', { action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-ten', unitPrice: '2.50' } })
    await waitFor('updated favorite price', () => observer.getCurrentResult().data?.items[0]?.editions.find((edition) => edition.id === 'one-of-ten')?.unitPrice === '2.50')
    return observer.getCurrentResult().data?.items[0]?.editions.find((edition) => edition.id === 'one-of-ten')?.unitPrice
  } finally { unsubscribe() }
}
