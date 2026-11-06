import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog.tsx'
import { Button } from '../../components/ui/button.tsx'
import { useRef, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import axios from 'axios'
import { catalogReady, discoveryQueries, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import type { Edition, NFT } from '../../shared/contracts.ts'
import { FavoriteButton } from '../favorites/FavoriteButton.tsx'
import { Footer } from '../layout/Footer.tsx'
import { AccountHeader } from '../account/AccountHeader.tsx'
import { LoadingSkeleton } from '../shared/LoadingSkeleton.tsx'
import '../account/wallets.css'
import './detail.css'

function ImageDialog({ item, index, setIndex, close }: { item: NFT; index: number; setIndex: (index: number) => void; close: () => void }) {
  const count = item.gallery.length
  function move(direction: number) { if (count > 1) setIndex((index + direction + count) % count) }
  return <Dialog open onOpenChange={(open) => { if (!open) close() }}><DialogContent className="detail-zoom" showCloseButton={false} aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); close() }} onKeyDown={(event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
  }}>
    <DialogTitle className="detail-zoom-title">Imagem ampliada</DialogTitle><button className="detail-zoom-close" type="button" autoFocus onClick={close} aria-label="Fechar imagem">×</button>
    {count > 1 && <button className="detail-zoom-prev" type="button" onClick={() => move(-1)} aria-label="Imagem anterior">‹</button>}
    <img src={item.gallery[index]?.url ?? item.artUrl} alt={item.gallery[index]?.alt || item.name} />
    {count > 1 && <button className="detail-zoom-next" type="button" onClick={() => move(1)} aria-label="Próxima imagem">›</button>}
    {count > 1 && <p aria-live="polite">Imagem {index + 1} de {count}</p>}
  </DialogContent></Dialog>
}

export function DetailPage({ nftId }: { nftId: string }) {
  const router = useRouter()
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const nft = useQuery({ ...discoveryQueries.detail(nftId), enabled: ready })
  const related = useQuery({ ...discoveryQueries.list({}), enabled: ready && Boolean(nft.data) })
  const [editionId, setEditionId] = useState<Edition['id']>('one-of-fifty')
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'details' | 'reviews'>('details')
  const zoomTrigger = useRef<HTMLButtonElement>(null)
  const operation = useRef<{ key: string; payload: string } | null>(null)
  const item = nft.data
  const edition = item?.editions.find((entry) => entry.id === editionId)
  const available = edition?.available ?? 0

  async function add(buy: boolean) {
    if (!item || !edition || busy || quantity < 1 || quantity > available) return
    const payload = JSON.stringify([item.id, edition.id, quantity])
    if (operation.current?.payload !== payload) operation.current = { key: crypto.randomUUID(), payload }
    setBusy(true); setMessage('')
    try {
      const { cart } = await import('../../app/marketplace-services.ts')
      const current = await cart.reconcile()
      await cart.add({ nftId: item.id, editionId: edition.id, quantity, mutationId: operation.current.key }, current.revision)
      operation.current = null
      if (buy) await router.navigate({ href: '/cart' })
      else setMessage('NFT adicionado ao carrinho.')
    } catch { setMessage('Não foi possível adicionar ao carrinho. Tente novamente.') }
    finally { setBusy(false) }
  }

  if (!item && (!ready || nft.isPending)) return <main className="detail-page"><div className="detail-desktop-header"><AccountHeader active="market" /></div><LoadingSkeleton kind="detail" /></main>
  if (!item) {
    const missing = axios.isAxiosError(nft.error) && nft.error.response?.status === 404
    return <main className="detail-page"><p role="alert">{missing ? 'Não foi possível encontrar este NFT.' : 'Não foi possível carregar o NFT.'}</p>{!missing && <button type="button" onClick={() => void nft.refetch()}>Tentar novamente</button>}<a href="/">Voltar ao início</a></main>
  }
  return <main className="detail-page">
    <div className="detail-desktop-header"><AccountHeader active="market" /></div>
    <div className="detail-shell">
      <p className="detail-breadcrumb">Início / Mercado</p>
      <div className="detail-hero"><div className="detail-nav"><a href="/" aria-label="Voltar ao início"><img src="/assets/icons/back-detail-mobile.svg" alt="" /></a><FavoriteButton nft={item} detail /></div><button ref={zoomTrigger} className="detail-image-button" type="button" onClick={() => setZoom(true)} aria-label="Ampliar imagem"><img src={item.gallery[imageIndex]?.url ?? item.artUrl} alt={item.name} fetchPriority="high" /><span className="detail-zoom-indicator" aria-hidden="true"><img src="/assets/icons/detail-zoom-desktop.svg" alt="" /></span></button></div>
      <section className="detail-sheet"><div className="detail-title"><h1>{item.name}</h1><span className="detail-rating"><span className="detail-rating-star" aria-hidden="true" /><strong>{item.rating}</strong><span>({item.ratingCount})</span></span></div><div className="detail-desktop-price"><strong>{edition?.unitPrice} ETH</strong><span className="detail-desktop-reviews"><span aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</span> {item.ratingCount} avaliações de colecionadores</span></div><strong className="detail-about-label">Sobre este NFT:</strong><p className="detail-description">{item.description}</p><strong>Edição:</strong><div className="detail-editions" role="group" aria-label="Edição">{item.editions.map((entry) => <button type="button" key={entry.id} aria-pressed={entry.id === editionId} disabled={busy || entry.available === 0} onClick={() => { setEditionId(entry.id); setQuantity(1); setMessage('') }}>{entry.label}</button>)}</div><dl className="detail-metadata"><div><dt>ID do token:</dt><dd>{item.tokenId}</dd></div><div><dt>Coleção:</dt><dd>{item.collection}</dd></div><div><dt>Atributos:</dt><dd>{item.attributes.join(', ') || '—'}</dd></div></dl><div className="detail-share"><strong>Compartilhar este NFT:</strong><a href={`https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: window.location.href })}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn"><img src="/assets/icons/context-ff3cb7cf633dbe6f.svg" alt="" /></a><a href={`mailto:?${new URLSearchParams({ body: window.location.href })}`} aria-label="Compartilhar por e-mail"><img src="/assets/icons/context-3b1d83e85ce80e2c.svg" alt="" /></a><a href={`https://twitter.com/intent/tweet?${new URLSearchParams({ url: window.location.href })}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no Twitter"><img src="/assets/icons/context-6c4b682b4ed5eb78.svg" alt="" /></a></div></section>
      <section className="detail-buy"><div className="detail-buy-row"><div className="detail-stepper"><span>Qtd.</span><button type="button" aria-label="Diminuir quantidade" disabled={busy || quantity <= 1} onClick={() => setQuantity(quantity - 1)}>−</button><span aria-live="polite">{quantity}</span><button type="button" aria-label="Aumentar quantidade" disabled={busy || quantity >= available} onClick={() => setQuantity(quantity + 1)}>+</button></div><strong>{edition?.unitPrice} ETH</strong></div>{available === 0 ? <p className="detail-stock-error" role="alert">Esta edição está esgotada. Escolha outra edição.</p> : quantity > available ? <p className="detail-stock-error" role="alert">Estoque disponível: {available}. Reduza a quantidade para continuar.</p> : null}{message && <p role="status">{message}</p>}<div className="detail-actions"><Button type="button" disabled={busy || available === 0 || quantity > available} onClick={() => void add(true)}>Comprar NFT</Button><button className="detail-add" type="button" aria-label="Adicionar ao carrinho" disabled={busy || available === 0 || quantity > available} onClick={() => void add(false)}><picture><source media="(max-width: 767px)" srcSet="/assets/icons/cart-detail-mobile.svg" /><img src="/assets/icons/cart-desktop.svg" alt="" /></picture></button><div className="detail-favorite-desktop"><FavoriteButton nft={item} /></div></div></section>
      <div className="detail-gallery" role="group" aria-label="Galeria">{item.gallery.map((image, index) => <button type="button" key={image.id} aria-label={`Imagem ${index + 1}`} aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}><img src={image.url} alt="" /></button>)}</div>
      <section className="detail-information"><div className="detail-info-tabs" role="tablist" aria-label="Informações do NFT"><button id="detail-tab-details" type="button" role="tab" aria-selected={tab === 'details'} aria-controls="detail-panel-details" tabIndex={tab === 'details' ? 0 : -1} onClick={() => setTab('details')} onKeyDown={(event) => { if (event.key === 'ArrowRight') { setTab('reviews'); document.getElementById('detail-tab-reviews')?.focus() } }}>Detalhes do NFT</button><button id="detail-tab-reviews" type="button" role="tab" aria-selected={tab === 'reviews'} aria-controls="detail-panel-reviews" tabIndex={tab === 'reviews' ? 0 : -1} onClick={() => setTab('reviews')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { setTab('details'); document.getElementById('detail-tab-details')?.focus() } }}>Avaliações de colecionadores ({item.ratingCount})</button></div><div role="tabpanel" id="detail-panel-details" aria-labelledby="detail-tab-details" hidden={tab !== 'details'}>{item.id === 'emerald-ape-042' ? <><p>Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.</p><p>A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.</p><p><strong>Rede:</strong> Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.</p><p><strong>Contrato:</strong> Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p><p><strong>Direitos autorais:</strong> 0x7A42...19E8 • Contrato inteligente ERC-721 verificado.</p></> : <p>{item.description || 'Não há informações adicionais disponíveis para este NFT.'}</p>}</div><div role="tabpanel" id="detail-panel-reviews" aria-labelledby="detail-tab-reviews" hidden={tab !== 'reviews'}><p>Nota {item.rating} · {item.ratingCount} avaliações de colecionadores.</p><p>Não há comentários disponíveis.</p></div></section>
      <section className="detail-related" aria-labelledby="detail-related-title"><h2 id="detail-related-title">Mais desta coleção</h2>{!related.data && related.isPending ? <p role="status">Carregando NFTs...</p> : !related.data ? <p role="alert">Não foi possível carregar os NFTs. <button type="button" onClick={() => void related.refetch()}>Tentar novamente</button></p> : <div className="detail-related-grid">{related.data.items.filter((candidate) => candidate.id !== item.id && candidate.collection === item.collection).slice(2, 7).map((candidate) => <article key={candidate.id}><a href={`/nfts/${encodeURIComponent(candidate.id)}`}><span className="detail-related-art"><img src={candidate.artUrl} alt="" /></span><span className="detail-related-name">{candidate.name}</span><strong className="detail-related-price">{candidate.editions[0]?.unitPrice} ETH</strong></a><FavoriteButton nft={candidate} /></article>)}</div>}<div className="detail-related-dots" aria-hidden="true"><i /><i /><i /></div></section>
      {zoom && <ImageDialog item={item} index={imageIndex} setIndex={setImageIndex} close={() => { setZoom(false); zoomTrigger.current?.focus() }} />}
      <div className="detail-footer"><Footer /></div>
    </div>
  </main>
}
