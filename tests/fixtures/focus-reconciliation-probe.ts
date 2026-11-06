import { QueryObserver } from '@tanstack/react-query'
import { discoveryQueries } from '../../src/app/catalog-queries.ts'
import { queryClient } from '../../src/app/query-client.ts'
import { realtime } from '../../src/app/realtime.ts'

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 8000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for focus reconciliation')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

export async function runFocusReconciliationProbe() {
  await waitFor(() => realtime.isReady)
  const observer = new QueryObserver(queryClient, discoveryQueries.list({ q: 'Emerald' }))
  const unsubscribe = observer.subscribe(() => {})
  try {
    await waitFor(() => observer.getCurrentResult().isSuccess)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await waitFor(() => realtime.isReady)
    const previous = observer.getCurrentResult().dataUpdatedAt
    window.dispatchEvent(new Event('focus'))
    const blocked = !realtime.isReady
    await waitFor(() => realtime.isReady && observer.getCurrentResult().dataUpdatedAt > previous)
    return { blocked, refreshed: true }
  } finally { unsubscribe() }
}
