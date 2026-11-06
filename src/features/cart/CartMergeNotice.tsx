import { useState, useSyncExternalStore } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { authFlow, sessionManager } from '../../app/session.ts'
import { queryClient } from '../../app/query-client.ts'
import { PENDING_MERGE_KEY } from '../../shared/visitor-cart.ts'
import './cart-merge-notice.css'

const subscribePending = (listener: () => void) => {
  const unsubscribe = authFlow.subscribe(listener)
  const storageChanged = (event: StorageEvent) => { if (event.key === PENDING_MERGE_KEY) listener() }
  window.addEventListener('storage', storageChanged)
  return () => { unsubscribe(); window.removeEventListener('storage', storageChanged) }
}
const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const sessionOwner = () => sessionManager.session?.userId ?? null

type Adjustment = { nftId: string; editionId: string; requested: number; accepted: number }

/** Keep a failed guest-cart merge recoverable even when the user leaves auth or reloads. */
export function CartMergeNotice() {
  const owner = useSyncExternalStore(subscribeSession, sessionOwner, () => null)
  const pending = useSyncExternalStore(subscribePending, () => authFlow.hasPendingMerge(), () => false)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [result, setResult] = useState<{ owner: string; adjustments: Adjustment[] } | null>(null)
  if (pathname === '/login' || pathname === '/signup' || (!pending && (!result || result.owner !== owner))) return null
  async function retry() {
    if (busy || !owner) return
    setBusy(true); setError(false)
    try {
      const merged = await authFlow.retryMerge()
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      if (sessionManager.session?.userId === owner) setResult({ owner, adjustments: merged.adjustments })
    } catch { if (sessionManager.session?.userId === owner) setError(true) }
    finally { setBusy(false) }
  }
  return <aside className="cart-merge-notice" aria-label="Sincronização do carrinho" role="status">
    {pending ? <><span>O carrinho ainda não foi sincronizado com sua conta.</span><button type="button" disabled={busy} onClick={() => void retry()}>{busy ? 'Sincronizando...' : 'Tentar novamente'}</button>{error && <span role="alert">Não foi possível sincronizar. Tente novamente.</span>}</> : <><span>{result?.adjustments.length ? 'Alguns itens foram ajustados conforme o estoque disponível:' : 'Carrinho sincronizado.'}</span>{result?.adjustments.length ? <ul>{result.adjustments.map((item) => <li key={`${item.nftId}:${item.editionId}`}>{item.nftId} · {item.editionId}: {item.accepted} de {item.requested} adicionados</li>)}</ul> : null}<button type="button" onClick={() => setResult(null)}>Fechar</button></>}
  </aside>
}
