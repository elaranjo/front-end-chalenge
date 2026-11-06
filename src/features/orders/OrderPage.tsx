import { Sheet, SheetContent, SheetTitle } from '../../components/ui/sheet.tsx'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { catalogReady, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { accountQueries } from '../../app/private-queries.ts'
import { sessionManager } from '../../app/session.ts'
import type { Order } from '../../shared/contracts.ts'
import './order.css'

const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const currentSession = () => sessionManager.session

const collectorFields = [
  ['displayName', 'Nome de exibição'], ['username', 'Nome de usuário'], ['network', 'Rede'],
  ['profileName', 'Nome do perfil'], ['address', 'Endereço da carteira'], ['secondaryAddress', 'ENS ou carteira secundária'],
  ['walletType', 'Tipo de carteira'], ['referralCode', 'Código de indicação'], ['email', 'E-mail'],
  ['ensName', 'Nome ENS'], ['note', 'Observação'],
] as const

function formatReceiptDate(timestamp: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(timestamp))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('day')} ${part('month')}, ${part('year')}`
}

function TransactionDialog({ order, close }: { order: Order; close: () => void }) {
  return <Sheet open onOpenChange={(open) => { if (!open) close() }}><SheetContent className="order-transaction-dialog" aria-describedby={undefined} showCloseButton={false}><SheetTitle>Transação simulada</SheetTitle><p>Esta transação faz parte da demonstração e não foi enviada a uma blockchain.</p><dl><div><dt>ID</dt><dd>{order.transaction?.id}</dd></div><div><dt>Rede</dt><dd>{order.transaction?.network}</dd></div><div><dt>Estado</dt><dd>Confirmada na simulação</dd></div></dl><button type="button" autoFocus onClick={close}>Fechar</button></SheetContent></Sheet>
}

function OrderContent({ orderId }: { orderId: string }) {
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const router = useRouter()
  const [notice, setNotice] = useState('')
  const [explorerOpen, setExplorerOpen] = useState(false)
  const explorerTrigger = useRef<HTMLButtonElement>(null)
  const order = useQuery({ ...accountQueries.order(orderId), enabled: ready, refetchInterval: (query) => query.state.data?.status === 'pending' ? 3000 : false })
  async function close(result: Order) {
    try {
      const { orderAttempts } = await import('../../app/marketplace-services.ts')
      if (orderAttempts.hasAttempt()) {
        const attempt = await orderAttempts.recover()
        if (attempt.id === result.id && attempt.status !== 'pending') orderAttempts.clear()
      }
      await router.navigate({ href: result.status === 'declined' ? '/cart' : '/' })
    } catch { setNotice('Não foi possível verificar a tentativa. Tente novamente.') }
  }
  if (!order.data) return <main className="order-page">{order.isError ? <div role="alert">Não foi possível carregar o pedido. <button onClick={() => void order.refetch()}>Tentar novamente</button><a href="/">Voltar ao início</a></div> : <p role="status">Carregando pedido...</p>}</main>
  const result = order.data
  if (result.status !== 'confirmed') return <main className="order-page"><section className="order-panel"><h1>{result.status === 'pending' ? 'Compra em processamento' : 'Compra recusada'}</h1><p>Pedido {result.id}</p>{result.declineReason && <p>{result.declineReason}</p>}{order.isError && <p role="alert">Não foi possível atualizar o pedido.</p>}{notice && <p role="alert">{notice}</p>}<button type="button" onClick={() => void order.refetch()}>Atualizar pedido</button>{result.status === 'declined' && <button type="button" onClick={() => void close(result)}>Voltar ao carrinho</button>}</section></main>
  const { snapshot } = result
  return <main className="order-page"><section className="order-panel order-receipt" aria-labelledby="receipt-title"><button className="order-close" type="button" aria-label="Fechar recibo" onClick={() => void close(result)}>×</button><img className="order-illustration" src="/assets/icons/order-thank-you.svg" alt="" /><h1 id="receipt-title">Seus NFTs agora estão na sua carteira</h1><dl className="order-metadata"><div><dt>ID da transação</dt><dd title={result.transaction?.id}>{result.transaction ? <><span aria-hidden="true">{`${result.transaction.id.slice(0, 6)}…${result.transaction.id.slice(-4)}`}</span><span className="order-visually-hidden">{result.transaction.id}</span></> : "Indisponível"}</dd></div><div><dt>Data</dt><dd>{formatReceiptDate(result.createdAt)}</dd></div><div><dt>Total</dt><dd>{snapshot.quote.total} ETH</dd></div><div><dt>Carteira</dt><dd>{({ metamask: "MetaMask", walletconnect: "WalletConnect", coinbase: "Coinbase Wallet" } as const)[snapshot.provider]}</dd></div></dl><h2>Detalhes da transação</h2><div className="order-item-heading" aria-hidden="true"><span>NFTs</span><span>Edições</span><span>Subtotal</span></div>{snapshot.items.map((item) => <article className="order-item" key={item.lineId}><div className="order-item-identity"><img src={item.nft.artUrl} alt="" /><div><strong>{item.nft.name}</strong><p>ID do token: {item.nft.tokenId}</p><p>Edição: {item.nft.editions.find((edition) => edition.id === item.editionId)?.label ?? item.editionId}</p></div></div><span className="order-item-quantity"><span aria-hidden="true">(x {item.quantity})</span><span className="order-visually-hidden">{`Quantidade: ${item.quantity} × ${item.unitPrice} ETH`}</span></span><strong>{item.lineTotal} ETH</strong></article>)}<dl className="order-totals"><div><dt>Subtotal</dt><dd>{snapshot.quote.subtotal} ETH</dd></div><div><dt>Desconto</dt><dd>{snapshot.quote.discount} ETH</dd></div><div><dt>Taxa de rede</dt><dd>{snapshot.quote.networkFee} ETH</dd></div><div><dt>Total</dt><dd>{snapshot.quote.total} ETH</dd></div></dl><details className="order-collector"><summary>Dados do colecionador</summary><dl><div><dt>Carteira selecionada</dt><dd>{snapshot.wallet.nickname}</dd></div>{collectorFields.map(([key, label]) => snapshot.collector[key] ? <div key={key}><dt>{label}</dt><dd>{snapshot.collector[key]}{key === 'ensName' ? '.eth' : ''}</dd></div> : null)}</dl></details>{snapshot.quote.coupon && <p>Cupom aplicado: {snapshot.quote.coupon.code}</p>}<p>Compra simulada confirmada na rede {snapshot.network}. Nenhuma transação blockchain real foi realizada.</p><p>Transação simulada: {result.transaction?.id}</p>{notice && <p role="alert">{notice}</p>}<button ref={explorerTrigger} type="button" onClick={() => setExplorerOpen(true)}>Ver transação simulada</button>{explorerOpen && <TransactionDialog order={result} close={() => { setExplorerOpen(false); explorerTrigger.current?.focus() }} />}</section></main>
}
export function OrderPage({ orderId }: { orderId: string }) {
  const session = useSyncExternalStore(subscribeSession, currentSession, () => null)
  const router = useRouter()
  useEffect(() => { if (!session) void router.navigate({ href: `/login?returnTo=${encodeURIComponent(`/orders/${orderId}`)}`, replace: true }) }, [orderId, router, session])
  return session ? <OrderContent key={`${session.userId}:${orderId}`} orderId={orderId} /> : null
}
