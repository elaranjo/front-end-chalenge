import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { shoppingCartQueries } from '../../app/cart-queries.ts'
import { catalogReady, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { sessionManager } from '../../app/session.ts'
import { HeaderLoginIcon } from '../layout/HeaderLoginIcon.tsx'

const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const currentSession = () => sessionManager.session

export function AccountHeader({ active = 'home' }: { active?: 'home' | 'market' }) {
  const router = useRouter()
  const session = useSyncExternalStore(subscribeSession, currentSession, () => null)
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const cart = useQuery({ ...shoppingCartQueries.current(), enabled: ready })
  const count = cart.data?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const loginTrigger = useRef<HTMLAnchorElement>(null)
  const source = `${location.pathname}${location.search}`
  useEffect(() => {
    const marker = sessionStorage.getItem('kurio.auth-account-focus')
    if (marker === `restore:${source}`) loginTrigger.current?.focus()
    if (marker === `restore:${source}` || marker === `pending:${source}`) sessionStorage.removeItem('kurio.auth-account-focus')
  }, [source])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    void router.navigate({ href: query ? `/?${new URLSearchParams({ q: query })}#catalogo` : '/#catalogo' })
  }
  return <><header className="wallet-header"><a href="/" className="account-logo">KURIO</a><nav aria-label="Navegação principal"><a href="/" aria-current={active === 'home' ? 'page' : undefined}>Início</a><a href="/#catalogo" aria-current={active === 'market' ? 'page' : undefined}>Mercado</a><button type="button" onClick={() => setNotice('Esta opção não está disponível nesta demonstração.')}>Criadores</button><button type="button" onClick={() => setNotice('Esta opção não está disponível nesta demonstração.')}>Aprenda</button></nav><div className="account-header-actions"><div className="account-search"><button ref={trigger} className="account-icon" type="button" aria-label="Buscar NFTs" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><img src="/assets/icons/context-43663fd7c3c84d7b.svg" alt="" /></button>{searchOpen && <form onSubmit={submit} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchOpen(false); trigger.current?.focus() } }}><label htmlFor="account-search">Buscar NFTs</label><input autoFocus id="account-search" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit">Buscar</button></form>}</div><a className="account-cart" href="/cart" aria-label={`Carrinho${count ? `, ${count} itens` : ''}`}><img src="/assets/icons/context-5e2917db4f8f9463.svg" alt="" />{count > 0 && <span className={count >= 100 ? "badge-wide" : undefined}>{count}</span>}</a><a ref={loginTrigger} className="account-login" href={session ? '/profile' : source.startsWith('/cart') ? `/login?${new URLSearchParams({ returnTo: source })}` : '/login'} onClick={() => { if (!session && source.startsWith('/cart')) sessionStorage.setItem('kurio.auth-account-focus', `pending:${source}`) }}><HeaderLoginIcon />{session ? 'Meu perfil' : 'Entrar'}</a></div></header>{notice && <p className="account-header-notice" role="status">{notice}</p>}</>
}
