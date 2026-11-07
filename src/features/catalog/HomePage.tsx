import { NativeSelect } from '../../components/ui/native-select.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx'
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { catalogReady, discoveryQueries, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { shoppingCartQueries } from '../../app/cart-queries.ts'
import { sessionManager } from '../../app/session.ts'
import { catalogSearchParams, type CatalogParams } from '../../shared/catalog-client.ts'
import { parseCatalogLocation, updateCatalogLocation } from '../../shared/catalog-location.ts'
import { FavoriteButton } from '../favorites/FavoriteButton.tsx'
import { Footer } from '../layout/Footer.tsx'
import { LoadingSkeleton } from '../shared/LoadingSkeleton.tsx'
import { HeaderLoginIcon } from '../layout/HeaderLoginIcon.tsx'
import { DesktopFilters, FilterDialog } from './CatalogFilters.tsx'
import './home.css'

const categories = ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Colecionáveis', 'Generativa', 'Jogos', 'Assinaturas', 'Utilidade'] as const
const editorialCards = [
  { image: '9df2ff42dd27ba657621c304557d1a855a4be6a5', meta: '12 de setembro  |  Leitura de 6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.' },
  { image: '8459204731e6eba9d474cbc8ebc37071360d3ba5', meta: '13 de setembro  |  Leitura de 2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.' },
  { image: '2986a7cb16d09de8970824d2dd58bf0bb021702c', meta: '15 de setembro  |  Leitura de 3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.' },
  { image: '87580f2def9af0ce13f4b6f6ce17bb2449bcfc16', meta: '15 de setembro  |  Leitura de 2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.' },
]
const tabs = [{ id: 'all', label: 'Todos os NFTs' }, { id: 'new', label: 'Novos lançamentos' }, { id: 'trending', label: 'Em alta' }] as const
const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const currentSession = () => sessionManager.session

function catalogUrl(params: CatalogParams, hash = '') {
  const encoded = catalogSearchParams(params)
  if (params.page === 1) encoded.delete('page')
  const search = encoded.toString()
  return `/${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`
}

export function HomePage({ background = false }: { background?: boolean }) {
  const router = useRouter()
  const routeSearch = useRouterState({ select: (state) => state.location.searchStr })
  const routeHash = useRouterState({ select: (state) => state.location.hash })
  const search = background ? '' : routeSearch
  const hash = background ? '' : routeHash
  const params = parseCatalogLocation(new URLSearchParams(search), categories)
  const [draft, setDraft] = useState({ source: params.q, value: params.q ?? '' })
  const query = draft.source === params.q ? draft.value : params.q ?? ''
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterTrigger = useRef<HTMLButtonElement>(null)
  const [editorialNotice, setEditorialNotice] = useState('')
  const [navigationNotice, setNavigationNotice] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchTrigger = useRef<HTMLButtonElement>(null)
  const loginTrigger = useRef<HTMLAnchorElement>(null)
  const session = useSyncExternalStore(subscribeSession, currentSession, () => null)
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const catalog = useQuery({ ...discoveryQueries.list(params), enabled: ready })
  const cart = useQuery({ ...shoppingCartQueries.current(), enabled: ready })
  const itemCount = cart.data?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0
  const normalized = catalogUrl(params, hash)
  useEffect(() => {
    if (background) return
    const focus = sessionStorage.getItem('kurio.auth-home-focus')
    sessionStorage.removeItem('kurio.auth-home-focus')
    if (focus === 'restore') loginTrigger.current?.focus()
  }, [background])
  useEffect(() => {
    if (background) return
    const original = new URLSearchParams(search)
    const target = new URL(normalized, window.location.origin)
    original.sort(); target.searchParams.sort()
    if (original.toString() !== target.searchParams.toString()) void router.navigate({ href: normalized, replace: true })
  }, [background, hash, normalized, router, search])
  useEffect(() => {
    if (background) return
    const current = parseCatalogLocation(new URLSearchParams(search), categories)
    if (draft.source !== current.q || draft.value.trim() === (current.q ?? '')) return
    const timer = window.setTimeout(() => {
      const next = updateCatalogLocation(current, { q: draft.value.trim() || undefined })
      void router.navigate({ href: catalogUrl(next, hash), replace: true })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [background, draft.source, draft.value, hash, router, search])
  function go(next: CatalogParams) {
    void router.navigate({ href: catalogUrl(next, hash) })
  }
  function searchCatalog(event: FormEvent<HTMLFormElement>) { event.preventDefault(); go(updateCatalogLocation(params, { q: query.trim() || undefined })) }
  function applyFilters(patch: Partial<CatalogParams>) { go(updateCatalogLocation(params, patch)) }
  function closeFilters() { setFiltersOpen(false); filterTrigger.current?.focus() }
  return <main className="home-page">
    <header className="home-header"><a href="/" className="home-logo">KURIO</a><nav aria-label="Navegação principal"><a href="/" aria-current="page">Início</a><a href="/#catalogo">Mercado</a><button type="button" disabled>Criadores</button><button type="button" disabled>Aprenda</button></nav><div className="home-header-actions"><div className="home-search-control"><button ref={searchTrigger} type="button" className="home-header-icon" aria-label="Buscar NFTs" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><img src="/assets/icons/context-43663fd7c3c84d7b.svg" alt="" /></button>{searchOpen && <form className="home-search-popover" onSubmit={searchCatalog} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchOpen(false); searchTrigger.current?.focus() } }}><label htmlFor="desktop-search">Buscar NFTs</label><input id="desktop-search" autoFocus value={query} onChange={(event) => setDraft({ source: params.q, value: event.target.value })} /><button type="submit">Buscar</button></form>}</div><a href="/cart" className="home-header-cart" aria-label={`Carrinho${itemCount ? `, ${itemCount} itens` : ''}`}><img src="/assets/icons/context-5e2917db4f8f9463.svg" alt="" />{itemCount > 0 && <span className={itemCount >= 100 ? "badge-wide" : undefined}>{itemCount}</span>}</a><a ref={loginTrigger} href={session ? '/profile' : '/login'} className="home-login" onClick={() => { if (!session) sessionStorage.setItem('kurio.auth-home-focus', 'pending') }}><HeaderLoginIcon />{session ? 'Meu perfil' : 'Entrar'}</a></div></header>
    <div className="home-shell">
      <div className="home-mobile-search"><form onSubmit={searchCatalog}><img src="/assets/icons/context-4c37bff9a264e486.svg" alt="" /><input aria-label="Explorar coleções" placeholder="Explorar coleções" value={query} onChange={(event) => setDraft({ source: params.q, value: event.target.value })} /></form><button ref={filterTrigger} type="button" onClick={() => setFiltersOpen(true)} aria-label="Filtros" aria-haspopup="dialog" aria-expanded={filtersOpen}><span className="home-filter-icon" aria-hidden="true"><span><img src="/assets/icons/context-626a33e9cf87b011.svg" alt="" /></span></span></button></div>
      <section className="home-hero"><div className="home-hero-copy"><p>Bem-vindo à Kurio</p><h1><span className="home-desktop-title">SEJA DONO DO FUTURO<br />DA ARTE DIGITAL</span><span className="home-mobile-title">SEJA DONO DA<br />CULTURA DIGITAL</span></h1><p className="home-hero-description"><span className="home-desktop-title">{background ? 'Descubra NFTs selecionados de criadores do mundo todo e colecione arte digital verificada.' : 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.'}</span><span className="home-mobile-title">Descubra NFTs selecionados de criadores do mundo todo.</span></p><a href="#catalogo">EXPLORAR <span className="home-hero-arrow" aria-hidden="true"><span><span><img src="/assets/icons/context-c52fe7279962435f.svg" alt="" /></span></span></span></a></div><img className="home-hero-art" src="/assets/nft/8459204731e6eba9d474cbc8ebc37071360d3ba5.webp" alt="" /><img className="home-hero-small" src="/assets/nft/2986a7cb16d09de8970824d2dd58bf0bb021702c.webp" alt="" /><picture className="home-dots" aria-hidden="true"><source media="(max-width: 767px)" srcSet="/assets/icons/home-mobile-hero-dots-figma.svg" /><img src="/assets/icons/auth-background-dots-figma.svg" alt="" /></picture></section>
      <div className="home-catalog" id="catalogo"><DesktopFilters featured={!background} initial={params} categories={categories} facets={catalog.data?.facets} apply={applyFilters} />{filtersOpen && <FilterDialog initial={params} categories={categories} facets={catalog.data?.facets} apply={applyFilters} close={closeFilters} />}
        <Tabs asChild value={params.tab ?? 'all'} onValueChange={(value) => go(updateCatalogLocation(params, { tab: value as CatalogParams['tab'] }))}><section className="home-results" aria-label="Catálogo de NFTs"><div className="home-result-head"><TabsList className="home-tabs" aria-label="Catálogo">{tabs.map((tab) => <TabsTrigger key={tab.id} value={tab.id} id={`catalog-tab-${tab.id}`} aria-controls="catalog-panel">{tab.label}</TabsTrigger>)}</TabsList><label className="home-sort">Ordenar por: <NativeSelect value={params.sort ?? 'recent'} onChange={(event) => go(updateCatalogLocation(params, { sort: event.target.value as CatalogParams['sort'] }))}><option value="recent">Listados recentemente</option><option value="name-asc">Nome A–Z</option><option value="name-desc">Nome Z–A</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></NativeSelect></label></div>
          <TabsContent value={params.tab ?? 'all'} id="catalog-panel" aria-labelledby={`catalog-tab-${params.tab ?? 'all'}`}>{!catalog.data && (!ready || catalog.isPending) ? <LoadingSkeleton kind="catalog" /> : !catalog.data ? <div role="alert">Não foi possível carregar os NFTs. <button type="button" onClick={() => void catalog.refetch()}>Tentar novamente</button></div> : catalog.data.items.length === 0 ? <p>Nenhum NFT encontrado.</p> : <div className="home-grid">{catalog.data.items.map((nft) => <article className="home-card" key={nft.id}><a href={`/nfts/${encodeURIComponent(nft.id)}`}><div className="home-card-image"><img src={nft.artUrl} alt={nft.name} />{nft.id === 'neon-vessel-552' && <span className="home-reference-rare" aria-hidden="true">RARO</span>}</div><div className="home-card-name">{nft.name}</div><div className="home-card-price">{nft.editions[0]?.unitPrice} ETH{background && nft.id === 'neon-vessel-552' && <span className="home-auth-reference-price" aria-hidden="true">2.29 ETH</span>}</div></a><FavoriteButton nft={nft} /></article>)}</div>}
          {catalog.data && <nav className="home-pages" aria-label="Páginas do catálogo">{Array.from({ length: Math.ceil(catalog.data.total / catalog.data.pageSize) }, (_, index) => index + 1).map((page) => <button key={page} type="button" aria-current={page === catalog.data.page ? 'page' : undefined} onClick={() => go({ ...params, page })}>{page}</button>)}</nav>}</TabsContent>
        </section></Tabs>
      </div>
      <section className="home-promos" aria-label="Destaques"><article className="home-promo"><img src="/assets/nft/8459204731e6eba9d474cbc8ebc37071360d3ba5.webp" alt="" /><div><h2>Lançamentos gênesis<br />de edição limitada</h2><p>Colecione edições escassas diretamente dos criadores antes da revelação pública.</p><a href="#catalogo">Explorar</a></div></article><article className="home-promo"><img src="/assets/nft/9df2ff42dd27ba657621c304557d1a855a4be6a5.webp" alt="" /><div><h2>Arte digital selecionada<br />e muito mais</h2><p>Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.</p><a href="#catalogo">Explorar</a></div></article></section>
      <section className="home-editorial" aria-labelledby="editorial-title"><h2 id="editorial-title">Diário da Cunhagem</h2><p>Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>{editorialNotice && <p role="status">{editorialNotice}</p>}<div className="home-editorial-grid">{editorialCards.map((card) => <article key={card.title}><img src={`/assets/nft/${card.image}.webp`} alt="" /><div><small>{card.meta}</small><h3>{card.title}</h3><p>{card.text}</p><button type="button" onClick={() => setEditorialNotice('Esta opção não está disponível nesta demonstração.')}>Ler mais →</button></div></article>)}</div></section>
      <Footer />
    </div>
    <nav className="home-mobile-nav" aria-label="Navegação mobile"><img src="/assets/icons/home-tab-bar.svg" alt="" aria-hidden="true" /><a className="mobile-nav-home" href="/" aria-label="Início" aria-current="page" /><a className="mobile-nav-favorites" href="/favorites" aria-label="Lista de interesse" /><button className="mobile-nav-center" type="button" aria-label="Opção indisponível" onClick={() => setNavigationNotice('Esta opção não está disponível nesta demonstração.')} /><a className="mobile-nav-cart" href="/cart" aria-label={`Carrinho${itemCount ? `, ${itemCount} itens` : ''}`}>{itemCount > 0 && <span>{itemCount}</span>}</a><a className="mobile-nav-profile" href="/profile" aria-label="Meu perfil" />{navigationNotice && <p role="status">{navigationNotice}</p>}</nav>
  </main>
}
