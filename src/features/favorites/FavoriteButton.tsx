import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { favorites } from '../../app/favorites.ts'
import { catalogReady, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { sessionManager } from '../../app/session.ts'
import type { NFT } from '../../shared/contracts.ts'
import { rememberFavoriteFocus, takeFavoriteFocus } from '../../shared/auth-favorite-focus.ts'
import './favorites.css'

const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const currentSession = () => sessionManager.session
function AuthenticatedFavorite({ nft, onError, detail }: { nft: NFT; onError?: () => void; detail?: boolean }) {
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const query = useQuery({ ...favorites.listQuery(), enabled: ready })
  const [error, setError] = useState(false)
  const intent = useRef(0)
  const selected = query.data?.items.some((item) => item.id === nft.id) ?? false
  async function toggle() {
    const revision = ++intent.current
    setError(false)
    try { await favorites.set(nft, !selected) }
    catch { if (revision === intent.current) { setError(true); onError?.() } }
  }
  return <span className={`favorite-control${detail ? ' favorite-detail' : ''}`}><button type="button" disabled={!ready || !query.data} aria-label={`${selected ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}: ${nft.name}`} aria-pressed={selected} onClick={() => void toggle()}>{detail ? <img src="/assets/icons/heart-detail-mobile.svg" alt="" /> : selected ? '♥' : '♡'}</button>{error && <span role="alert">Não foi possível atualizar os favoritos. Tente novamente.</span>}</span>
}
export function FavoriteButton({ nft, onError, detail }: { nft: NFT; onError?: () => void; detail?: boolean }) {
  const session = useSyncExternalStore(subscribeSession, currentSession, () => null)
  const trigger = useRef<HTMLAnchorElement>(null)
  const source = `${location.pathname}${location.search}`
  useEffect(() => {
    if (session) return
    const timer = window.setTimeout(() => {
      if (trigger.current?.isConnected && !trigger.current.closest('.auth-background') && takeFavoriteFocus(nft.id, Boolean(detail), source)) trigger.current.focus()
    }, 100)
    return () => window.clearTimeout(timer)
  }, [session, nft.id, detail, source])
  if (!session) return <a ref={trigger} onClick={() => rememberFavoriteFocus(nft.id, Boolean(detail), source)} className={`favorite-control${detail ? ' favorite-detail' : ''}`} href={`/login?${new URLSearchParams({ returnTo: source })}`} aria-label={`Entrar para favoritar: ${nft.name}`}>{detail ? <img src="/assets/icons/heart-detail-mobile.svg" alt="" /> : '♡'}</a>
  return <AuthenticatedFavorite key={session.userId} nft={nft} onError={onError} detail={detail} />
}
