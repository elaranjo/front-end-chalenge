import { AccountNavigation } from '../account/AccountNavigation.tsx'
import { AccountHeader } from '../account/AccountHeader.tsx'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { favorites } from '../../app/favorites.ts'
import { catalogReady, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { logoutWithFeedback, sessionManager } from '../../app/session.ts'
import { FavoriteButton } from './FavoriteButton.tsx'
import '../account/wallets.css'
import '../catalog/home.css'
import './favorites.css'

const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const currentSession = () => sessionManager.session
function FavoritesContent() {
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const query = useQuery({ ...favorites.listQuery(), enabled: ready })
  const router = useRouter()
  const [notice, setNotice] = useState('')
  async function logout() { await logoutWithFeedback(() => router.navigate({ href: '/' })) }
  return <main className="wallet-page favorites-page"><AccountHeader /><div className="wallet-layout"><AccountNavigation active="favorites" onUnavailable={() => setNotice('Esta opção não está disponível nesta demonstração.')} onLogout={() => void logout()} /><section><div className="wallet-heading"><h1>Lista de interesse</h1></div>{notice && <p role="status">{notice}</p>}{!query.data && (!ready || query.isPending) ? <p role="status">Carregando favoritos...</p> : !query.data ? <p role="alert">Não foi possível carregar os favoritos. <button onClick={() => void query.refetch()}>Tentar novamente</button></p> : query.data.items.length === 0 ? <p>Você ainda não tem NFTs na lista de interesse. <a href="/">Explorar NFTs</a></p> : <div className="home-grid favorites-grid">{query.data.items.map((nft) => <article className="home-card" key={nft.id}><a href={`/nfts/${encodeURIComponent(nft.id)}`}><div className="home-card-image"><img src={nft.artUrl} alt={nft.name} /></div><div className="home-card-name">{nft.name}</div><div className="home-card-price">{nft.editions[0]?.unitPrice} ETH</div></a><FavoriteButton nft={nft} onError={() => setNotice('Não foi possível atualizar os favoritos. Tente novamente.')} /></article>)}</div>}<p><a href="/">Voltar ao catálogo</a></p></section></div></main>
}
export function FavoritesPage() {
  const session = useSyncExternalStore(subscribeSession, currentSession, () => null)
  const router = useRouter()
  useEffect(() => { if (!session) void router.navigate({ href: '/login?returnTo=%2Ffavorites', replace: true }) }, [router, session])
  return session ? <FavoritesContent key={session.userId} /> : null
}
