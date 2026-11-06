import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import axios from 'axios'
import { shoppingCartQueries } from '../../app/cart-queries.ts'
import { catalogReady, discoveryQueries, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { sessionManager } from '../../app/session.ts'
import { formatEth, lineTotal } from '../../shared/money.ts'
import { Footer } from '../layout/Footer.tsx'
import { AccountHeader } from '../account/AccountHeader.tsx'
import { LoadingSkeleton } from '../shared/LoadingSkeleton.tsx'
import '../account/wallets.css'
import './cart.css'

const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const sessionGeneration = () => sessionManager.sessionGeneration

export function CartPage() {
  const router = useRouter()
  useSyncExternalStore(subscribeSession, sessionGeneration, () => 0)
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const cart = useQuery({ ...shoppingCartQueries.current(), enabled: ready })
  const recommendations = useQuery({ ...discoveryQueries.list({}), enabled: ready })
  const [coupon, setCoupon] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [couponError, setCouponError] = useState(false)
  const [changeNotice, setChangeNotice] = useState<{ owner: string; text: string } | null>(null)
  const data = cart.data
  const previous = useRef<typeof data>(undefined)
  const blocked = !data?.lines.length || !data.quote || cart.isFetching || cart.isError || data.lines.some((line) => line.quantity > line.available)
  useEffect(() => {
    if (!data) return
    const old = previous.current
    previous.current = data
    if (!old) return
    if (old.id !== data.id) return
    const changed = data.lines.filter((line) => {
      const before = old.lines.find((item) => item.lineId === line.lineId)
      return before && (before.unitPrice !== line.unitPrice || before.available !== line.available)
    })
    if (changed.length) setChangeNotice({ owner: data.id, text: `Preço ou disponibilidade atualizado: ${changed.map((line) => line.nft.name).join(', ')}. Revise o carrinho antes de continuar.` })
  }, [data])

  async function mutate(action: 'change' | 'remove' | 'apply' | 'removeCoupon', lineId = '', quantity = 0) {
    if (busy) return
    setBusy(true); setMessage(''); setCouponError(false)
    try {
      const { cart: client } = await import('../../app/marketplace-services.ts')
      const current = await client.reconcile()
      if (action === 'change') await client.change(lineId, quantity, current.revision)
      else if (action === 'remove') await client.remove(lineId, current.revision)
      else if (action === 'apply') await client.applyCoupon(coupon, current.revision)
      else await client.removeCoupon(current.revision)
      if (action === 'apply' || action === 'removeCoupon') setCoupon('')
    } catch (error) {
      const text = axios.isAxiosError(error) ? error.response?.data?.error?.message : undefined
      setCouponError(action === 'apply')
      setMessage(text || 'Não foi possível atualizar o carrinho. Tente novamente.')
    } finally { setBusy(false) }
  }
  async function retryCart() {
    const generation = sessionManager.sessionGeneration
    const { realtime } = await import('../../app/realtime.ts')
    if (sessionManager.sessionGeneration !== generation) return
    realtime.retryReconciliation()
    await cart.refetch()
  }
  function apply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (coupon.trim()) void mutate('apply') }
  function checkout() {
    if (blocked || busy) return
    void router.navigate({ href: sessionManager.session ? '/checkout' : '/login?returnTo=%2Fcheckout' })
  }
  return <main className="cart-page">
    <div className="cart-desktop-header"><AccountHeader active="market" /></div>
    <div className="cart-layout"><section className="cart-content"><div className="cart-title"><a href="/" aria-label="Voltar ao início"><img src="/assets/icons/back-detail-mobile.svg" alt="" /></a><h1>Carrinho de NFTs</h1></div><p className="cart-breadcrumb">Início / Mercado / Carrinho</p>
      {!data && (!ready || cart.isPending) ? <LoadingSkeleton kind="cart" /> : !data ? <div role="alert">Não foi possível carregar o carrinho. <button type="button" onClick={() => void cart.refetch()}>Tentar novamente</button></div> : data.lines.length === 0 ? <p className="cart-empty">Seu carrinho está vazio. <a href="/">Continuar explorando</a></p> : <><div className="cart-table-head"><span>NFTs</span><span>Preço</span><span>Edições</span><span>Total</span></div><div className="cart-lines">{data.lines.map((line) => <article className="cart-line" key={line.lineId}><img src={line.nft.artUrl} alt="" /><img className="cart-art-overlay" src={line.nft.artUrl} alt="" aria-hidden="true" /><div className="cart-line-info"><strong>{line.nft.name}</strong><span className="cart-edition">Edição: {line.nft.editions.find((edition) => edition.id === line.editionId)?.label}</span><span className="cart-token">ID do token: {line.nft.tokenId}</span><b>{formatEth(lineTotal(line.unitPrice, line.quantity))} ETH</b>{line.quantity > line.available && <span role="alert">Estoque disponível: {line.available}</span>}</div><span className="cart-unit">{line.unitPrice} ETH</span><div className="cart-stepper"><button type="button" aria-label={`Diminuir quantidade de ${line.nft.name}`} disabled={busy || !ready || line.quantity <= 1} onClick={() => void mutate('change', line.lineId, line.quantity - 1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Aumentar quantidade de ${line.nft.name}`} disabled={busy || !ready || line.quantity >= line.available} onClick={() => void mutate('change', line.lineId, line.quantity + 1)}>+</button></div><span className="cart-line-total">{formatEth(lineTotal(line.unitPrice, line.quantity))} ETH</span><button className="cart-remove" type="button" disabled={busy || !ready} onClick={() => void mutate('remove', line.lineId)} aria-label={`Remover ${line.nft.name}`}><picture><source media="(min-width: 1280px)" srcSet="/assets/icons/cart-remove-desktop.svg" /><img src="/assets/icons/cart-remove.svg" alt="" /></picture></button></article>)}</div></>}
    </section><section className="cart-summary" aria-label="Resumo da carteira"><h2>Resumo da carteira</h2>{data && cart.isError && <p className="cart-error" role="alert">Não foi possível atualizar o carrinho. Os valores exibidos podem estar desatualizados. <button type="button" onClick={() => void retryCart()}>Tentar novamente</button></p>}{data && cart.isFetching && <p role="status">Atualizando o carrinho...</p>}{changeNotice && data?.id === changeNotice.owner && <p className="cart-error" role="status">{changeNotice.text}</p>}<form onSubmit={apply}><label htmlFor="coupon" className="cart-coupon-label">Código promocional</label><div className="cart-coupon"><input id="coupon" value={coupon} onChange={(event) => { setCoupon(event.target.value); if (couponError) { setCouponError(false); setMessage('') } }} aria-invalid={couponError} aria-describedby={couponError ? 'cart-error' : undefined} placeholder="Digite o código promocional..." /><button disabled={busy || !ready || !coupon.trim()}>Aplicar</button></div></form>{data?.couponCode && <p className="cart-applied">{data.couponCode} <button type="button" disabled={busy || !ready} onClick={() => void mutate('removeCoupon')}>Remover cupom</button></p>}{message && <p id="cart-error" className="cart-error" role="alert">{message}</p>}{data?.adjustments.map((adjustment) => <p className="cart-error" role="status" key={adjustment}>{adjustment === 'COUPON_EXPIRED' ? 'O cupom expirou.' : adjustment}</p>)}
      {data?.quote ? <dl className="cart-totals"><div><dt>Subtotal</dt><dd>{data.quote.subtotal} ETH</dd></div><div><dt>Desconto do lançamento</dt><dd>(−) {data.quote.discount}</dd></div><div><dt>Taxa de rede</dt><dd>{data.quote.networkFee} ETH<small>Taxa estimada</small></dd></div><div className="cart-total"><dt>Total</dt><dd>{data.quote.total} ETH</dd></div></dl> : data || cart.isError ? <p role="alert">Resumo indisponível. <button type="button" onClick={() => void retryCart()}>Tentar novamente</button></p> : <LoadingSkeleton kind="summary" />}
      <button className="cart-checkout" type="button" disabled={blocked || busy || !ready} onClick={checkout}>Conectar e finalizar</button><a className="cart-continue" href="/">Continuar explorando</a>
    </section></div><section className="cart-recommendations" aria-labelledby="cart-recommendations-title"><h2 id="cart-recommendations-title">Colecionadores também viram</h2>{recommendations.isPending ? <p role="status">Carregando NFTs...</p> : recommendations.isError ? <p role="alert">Não foi possível carregar os NFTs. <button type="button" onClick={() => void recommendations.refetch()}>Tentar novamente</button></p> : <div className="cart-recommendation-grid">{recommendations.data?.items.slice(3, 8).map((nft) => <article key={nft.id}><a href={`/nfts/${encodeURIComponent(nft.id)}`}><span className="cart-recommendation-art"><img src={nft.artUrl} alt="" /></span><span>{nft.name}</span><strong>{nft.editions[0]?.unitPrice} ETH</strong></a></article>)}</div>}<div className="cart-recommendation-dots" aria-hidden="true"><i /><i /><i /></div></section><div className="cart-footer"><Footer /></div>
  </main>
}
