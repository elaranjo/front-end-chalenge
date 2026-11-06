import { containDialogFocus } from '../../shared/dialog-focus.ts'
import { Checkbox } from '../../components/ui/checkbox.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Button } from '../../components/ui/button.tsx'
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import axios from 'axios'
import { queryClient } from '../../app/query-client.ts'
import { shoppingCartQueries } from '../../app/cart-queries.ts'
import { catalogReady, catalogReadinessRevision, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { accountQueries } from '../../app/private-queries.ts'
import { sessionManager } from '../../app/session.ts'
import { collectorInputSchema, type Cart, type CheckoutDraft, type Order, type Quote, type Wallet } from '../../shared/contracts.ts'
import { formatEth, lineTotal } from '../../shared/money.ts'
import { AccountHeader } from '../account/AccountHeader.tsx'
import { Footer } from '../layout/Footer.tsx'
import '../account/wallets.css'
import './checkout.css'

type Connection = Awaited<ReturnType<typeof import('../../app/marketplace-services.ts').wallets.connect>>
const emptyDraft: CheckoutDraft = { collector: {}, useOtherWallet: false }
const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const currentSession = () => sessionManager.session
const collectorLabels: Array<[keyof CheckoutDraft['collector'], string]> = [['displayName', 'Nome de exibição'], ['username', 'Nome de usuário'], ['network', 'Rede'], ['profileName', 'Nome do perfil'], ['address', 'Endereço da carteira'], ['secondaryAddress', 'ENS ou carteira secundária'], ['walletType', 'Tipo de carteira'], ['referralCode', 'Código de indicação'], ['email', 'E-mail'], ['ensName', 'Nome ENS'], ['note', 'Observações']]

function ReviewDialog({ draft, cart, totals, previous, selected, reason, close }: { draft: CheckoutDraft; cart: Cart; totals: Quote | null; previous: Quote | null; reason: 'expired' | 'changed' | null; selected: Wallet | undefined; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const current = dialog.current; if (current && !current.open) current.showModal(); return () => { if (current?.open) current.close() } }, [])
  function dismiss() { dialog.current?.close(); close() }
  return <dialog ref={dialog} className="checkout-review-dialog" aria-label="Revisão dos dados" onCancel={(event) => { event.preventDefault(); dismiss() }} onKeyDown={containDialogFocus}><h2 tabIndex={-1} autoFocus>Revisar dados</h2>{reason && <p role="status">{reason === 'expired' ? 'A cotação expirou. Revise a nova cotação e confirme novamente.' : 'A cotação foi atualizada. Revise as informações e confirme novamente.'}</p>}<dl>{collectorLabels.map(([key, label]) => draft.collector[key] ? <div key={key}><dt>{label}</dt><dd>{draft.collector[key]}{key === 'ensName' ? '.eth' : ''}</dd></div> : null)}</dl><h3>Carteira e rede</h3><p>{selected ? `${selected.nickname} · ${selected.network}` : 'Nenhuma carteira selecionada'} · {draft.provider ?? 'Provedor não selecionado'}</p><h3>Itens</h3>{cart.lines.map((line) => { const prior = previous?.lines.find((item) => item.lineId === line.lineId); return <p key={line.lineId}>{line.nft.name} · {line.quantity} × {line.unitPrice} ETH{prior && (prior.quantity !== line.quantity || prior.unitPrice !== line.unitPrice) && <span> (Anterior: {prior.quantity} × {prior.unitPrice} ETH)</span>}</p> })}{previous?.lines.filter((line) => !cart.lines.some((item) => item.lineId === line.lineId)).map((line) => <p key={line.lineId}>Item removido: {line.nftId} · {line.quantity} × {line.unitPrice} ETH</p>)}{previous && (previous.coupon?.code ?? null) !== (totals?.coupon?.code ?? null) && <p>Cupom anterior: {previous.coupon?.code ?? 'nenhum'} · Atual: {totals?.coupon?.code ?? 'nenhum'}</p>}{totals && <dl>{([['subtotal', 'Subtotal'], ['discount', 'Desconto'], ['networkFee', 'Taxa de rede'], ['total', 'Total']] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{previous && previous[key] !== totals[key] && <span>Anterior: {previous[key]} ETH · </span>}{totals[key]} ETH</dd></div>)}</dl>}{previous && totals && (JSON.stringify(previous.lines) !== JSON.stringify(totals.lines) || previous.coupon?.code !== totals.coupon?.code) && <p role="status">Os itens, preços, quantidades ou o cupom da cotação foram alterados. Confira o resumo atualizado antes de confirmar.</p>}<button type="button" onClick={dismiss}>Fechar</button></dialog>
}

function CheckoutWorkspace({ cart, wallets, ready, readinessRevision }: { cart: Cart; wallets: Wallet[]; ready: boolean; readinessRevision: number }) {
  const router = useRouter()
  const [draft, setDraft] = useState<CheckoutDraft>(emptyDraft)
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteRevision, setQuoteRevision] = useState(-1)
  const [order, setOrder] = useState<Order | null>(null)
  const [hasAttempt, setHasAttempt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CheckoutDraft['collector'], string>>>({})
  const [cartIssue, setCartIssue] = useState(false)
  const [step, setStep] = useState(1)
  const [review, setReview] = useState(false)
  const [previousQuote, setPreviousQuote] = useState<Quote | null>(null)
  const [reviewReason, setReviewReason] = useState<'expired' | 'changed' | null>(null)
  const reviewOrigin = useRef<HTMLElement | null>(null)
  const firstField = useRef<HTMLInputElement>(null)
  const pendingFieldFocus = useRef<string | null>(null)
  const previousStep = useRef(step)
  useEffect(() => {
    if (previousStep.current !== step && window.matchMedia('(max-width: 1279px)').matches) window.scrollTo({ top: 0 })
    previousStep.current = step
  }, [step])
  function openReview(previous: Quote | null = null, reason: 'expired' | 'changed' | null = null) { reviewOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPreviousQuote(previous); setReviewReason(reason); setReview(true) }
  function closeReview() { setReview(false); reviewOrigin.current?.focus() }
  const selected = wallets.find((wallet) => wallet.id === draft.walletId)
  const provider = draft.provider
  useEffect(() => {
    let active = true
    void import('../../app/marketplace-services.ts').then(async ({ checkoutDraft, orderAttempts }) => {
      const saved = checkoutDraft.load()
      const attempted = orderAttempts.hasAttempt()
      if (!active) return
      if (saved) setDraft(saved)
      setHasAttempt(attempted); setLoaded(true)
      if (attempted) {
        try { const result = await orderAttempts.recover(); if (active) { setOrder(result); void router.navigate({ href: `/orders/${encodeURIComponent(result.id)}`, replace: true }) } }
        catch { if (active) setMessage('Não foi possível consultar a tentativa anterior. Tente recuperá-la antes de continuar.') }
      }
    }).catch(() => { if (active) { setLoadFailed(true); setMessage('Não foi possível recuperar os dados do checkout.') } })
    return () => { active = false }
  }, [router])
  useEffect(() => {
    if (!loaded) return
    let active = true
    void import('../../app/marketplace-services.ts').then(({ checkoutDraft }) => { if (active) checkoutDraft.save(draft) }).catch(() => { if (active) setMessage('Não foi possível salvar os dados do checkout.') })
    return () => { active = false }
  }, [draft, loaded])
  useEffect(() => {
    if (step !== 1 || !pendingFieldFocus.current) return
    document.getElementById(`checkout-${pendingFieldFocus.current}`)?.focus()
    pendingFieldFocus.current = null
  }, [fieldErrors, step])
  const validQuote = quoteRevision === readinessRevision && quote?.cartRevision === cart.revision && quote.catalogVersion === cart.catalogVersion ? quote : null
  const change = (field: keyof CheckoutDraft['collector'], value: string) => { setDraft((current) => ({ ...current, collector: { ...current.collector, [field]: value } })); setFieldErrors((current) => ({ ...current, [field]: undefined })); setMessage((current) => current === 'Confira todos os campos obrigatórios e o endereço da carteira.' ? '' : current) }
  async function choose(wallet: Wallet, focusFields = false) {
    if (busy) return
    if (connection) {
      setBusy(true)
      try { const { wallets: client } = await import('../../app/marketplace-services.ts'); await client.disconnect(connection.id) }
      catch { setMessage('Não foi possível desconectar a carteira.'); setBusy(false); return }
      setBusy(false)
    }
    setConnection(null); setQuote(null); setFieldErrors({})
    setDraft((current) => ({ ...current, walletId: wallet.id, provider: wallet.type, network: wallet.network, collector: { ...current.collector, displayName: wallet.displayName, username: wallet.nickname, network: wallet.network, profileName: wallet.profileName, address: wallet.address, secondaryAddress: wallet.secondaryAddress ?? '', walletType: wallet.type, referralCode: wallet.referralCode, email: wallet.email, ensName: wallet.ensName } }))
    if (focusFields) firstField.current?.focus()
  }
  async function chooseProvider(next: Wallet['type']) {
    if (busy || next === provider) return
    if (connection) {
      setBusy(true)
      try { const { wallets: client } = await import('../../app/marketplace-services.ts'); await client.disconnect(connection.id) }
      catch { setMessage('Não foi possível desconectar a carteira.'); setBusy(false); return }
      setBusy(false)
    }
    setConnection(null); setQuote(null); setDraft((current) => ({ ...current, provider: next }))
  }
  async function connect() {
    if (!selected || !provider || !ready || busy) return
    setBusy(true); setMessage(''); setCartIssue(false)
    const revision = readinessRevision
    try {
      const services = await import('../../app/marketplace-services.ts')
      const next = await services.wallets.connect({ walletId: selected.id, provider, network: selected.network })
      if (next.status !== 'connected') { setConnection(null); setMessage('A conexão da carteira foi recusada.'); return }
      const result = await services.checkoutQuotes.fetch({ walletId: selected.id, provider, network: selected.network, cartRevision: cart.revision })
      setConnection(next); setQuote(result.quote); setQuoteRevision(revision)
    } catch { setConnection(null); setQuote(null); setMessage('Não foi possível conectar a carteira ou obter a cotação. Tente novamente.') }
    finally { setBusy(false) }
  }
  async function disconnect() {
    if (busy) return false
    if (!connection) return true
    setBusy(true)
    try { const { wallets: client } = await import('../../app/marketplace-services.ts'); await client.disconnect(connection.id); setConnection(null); setQuote(null); setMessage(''); return true }
    catch { setMessage('Não foi possível desconectar a carteira.'); return false }
    finally { setBusy(false) }
  }
  async function changeWallet() {
    if (!await disconnect()) return
    setDraft((current) => ({ ...current, walletId: undefined, provider: undefined, network: undefined }))
    setQuote(null)
  }
  async function editWallet() {
    if (!await disconnect()) return
    const next: CheckoutDraft = { ...draft, walletId: undefined, provider: undefined, network: undefined }
    try {
      const { checkoutDraft } = await import('../../app/marketplace-services.ts')
      checkoutDraft.save(next)
      setDraft(next)
      await router.navigate({ href: '/wallets?returnTo=%2Fcheckout' })
    } catch { setMessage('Não foi possível abrir a edição da carteira. Tente novamente.') }
  }
  async function refreshQuote() {
    if (!selected || !provider || !connection || !ready || busy) return
    setBusy(true); setMessage(''); setCartIssue(false)
    const revision = readinessRevision
    try {
      const { checkoutQuotes } = await import('../../app/marketplace-services.ts')
      const result = await checkoutQuotes.fetch({ walletId: selected.id, provider, network: selected.network, cartRevision: cart.revision })
      setQuote(result.quote); setQuoteRevision(revision)
      setMessage('A cotação foi atualizada. Revise os valores antes de confirmar.')
      if (quote) openReview(quote, 'changed')
    } catch (error) {
      const code: unknown = axios.isAxiosError(error) ? error.response?.data?.error?.code : undefined
      if (code === 'COUPON_EXPIRED' || code === 'EDITION_UNAVAILABLE' || code === 'REVISION_CONFLICT') {
        setQuoteRevision(-1); setCartIssue(true)
        setMessage(code === 'COUPON_EXPIRED' ? 'O cupom expirou. Remova-o no carrinho antes de continuar.' : 'O carrinho ou a disponibilidade mudaram. Revise o carrinho antes de continuar.')
        void queryClient.invalidateQueries({ queryKey: ['cart'] })
      } else setMessage('Não foi possível atualizar a cotação. Tente novamente.')
    }
    finally { setBusy(false) }
  }
  async function recover(retry = false) {
    if (busy) return
    setBusy(true); setMessage('')
    try { const { orderAttempts } = await import('../../app/marketplace-services.ts'); const result = await (retry ? orderAttempts.retry() : orderAttempts.recover()); setOrder(result); setHasAttempt(true); await router.navigate({ href: `/orders/${encodeURIComponent(result.id)}` }) }
    catch {
      const { orderAttempts } = await import('../../app/marketplace-services.ts')
      if (!orderAttempts.hasAttempt()) {
        setHasAttempt(false); setConnection(null); setQuote(null)
        setMessage('A tentativa foi recusada antes da criação do pedido. Conecte a carteira e revise uma nova cotação.')
      } else setMessage('Não foi possível recuperar a tentativa. Tente novamente com a mesma conta.')
    }
    finally { setBusy(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const collector = collectorInputSchema.safeParse(draft.collector)
    if (!collector.success) {
      const errors: Partial<Record<keyof CheckoutDraft['collector'], string>> = {}
      for (const issue of collector.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string') errors[field as keyof CheckoutDraft['collector']] = 'Verifique este campo.'
      }
      pendingFieldFocus.current = Object.keys(errors)[0] ?? null
      setFieldErrors(errors); setMessage('Confira todos os campos obrigatórios e o endereço da carteira.'); setStep(1); return
    }
    setFieldErrors({})
    if (!selected || !provider || !connection || !validQuote || !ready || busy || hasAttempt) return
    setBusy(true); setMessage(''); setCartIssue(false)
    try {
      const services = await import('../../app/marketplace-services.ts')
      const result = await services.checkout.submit(validQuote, { walletId: selected.id, provider, network: selected.network, collector: collector.data }, connection)
      if (result.status === 'review-required') { setQuote(result.current); setMessage(result.reason === 'expired' ? 'A cotação expirou. Revise e confirme novamente.' : 'Os valores ou a disponibilidade mudaram. Revise o resumo e confirme novamente.'); openReview(result.previous, result.reason) }
      else { setOrder(result.order); setHasAttempt(true); await router.navigate({ href: `/orders/${encodeURIComponent(result.order.id)}` }) }
    } catch (error) {
      const { orderAttempts } = await import('../../app/marketplace-services.ts')
      const pending = orderAttempts.hasAttempt()
      setHasAttempt(pending)
      const code: unknown = axios.isAxiosError(error) ? error.response?.data?.error?.code : undefined
      if (!pending && code === 'STALE_QUOTE') { setQuoteRevision(-1); setMessage('A cotação mudou. Atualize e revise os valores antes de confirmar novamente.') }
      else if (!pending && code === 'CONNECTION_INVALID') { setConnection(null); setQuote(null); setMessage('A conexão da carteira foi encerrada. Conecte-a novamente.') }
      else if (!pending && (code === 'COUPON_EXPIRED' || code === 'EDITION_UNAVAILABLE' || code === 'REVISION_CONFLICT')) {
        setQuoteRevision(-1); setCartIssue(true)
        setMessage(code === 'COUPON_EXPIRED' ? 'O cupom expirou. Remova-o no carrinho antes de continuar.' : 'O carrinho ou a disponibilidade mudaram. Revise o carrinho antes de continuar.')
        void queryClient.invalidateQueries({ queryKey: ['cart'] })
      } else setMessage(pending ? 'A resposta da compra não foi recebida. Recupere a tentativa existente antes de continuar.' : 'Não foi possível confirmar a compra. Confira os dados e tente novamente.')
    } finally { setBusy(false) }
  }
  const totals = validQuote ?? cart.quote
  if (!loaded) return <main className="checkout-page">{loadFailed ? <div role="alert">{message} <button type="button" onClick={() => location.reload()}>Tentar novamente</button></div> : <p role="status">Carregando pagamento...</p>}</main>
  return <main className="checkout-page"><div className="checkout-desktop-header"><AccountHeader active="market" /></div><div className="checkout-wrap"><div className="checkout-title"><button className="checkout-page-back" type="button" aria-label="Voltar" onClick={() => { if (step === 2) setStep(1); else void router.navigate({ href: '/cart' }) }}><img src="/assets/icons/back-detail-mobile.svg" alt="" /></button><h1>Pagamento com carteira</h1></div><p className="checkout-breadcrumb">Início / Mercado / Pagamento</p>{message && <p role="alert">{message}{cartIssue && <> <a href="/cart">Ir ao carrinho</a></>}</p>}{hasAttempt ? <section aria-label="Tentativa de compra"><h2>{order?.status === 'confirmed' ? 'Compra confirmada' : order?.status === 'declined' ? 'Compra recusada' : 'Compra em processamento'}</h2>{order && <p>Pedido {order.id} {order.status === 'declined' && order.declineReason}</p>}<button type="button" disabled={busy} onClick={() => void recover()}>Atualizar pedido</button>{!order && <button type="button" disabled={busy} onClick={() => void recover(true)}>Reenviar a mesma tentativa</button>}</section> : <form onSubmit={(event) => void submit(event)} noValidate><div className="checkout-columns"><section className={`checkout-details ${step === 2 ? 'checkout-mobile-hidden' : ''}`}><h2>Perfil do colecionador</h2>{(!selected || draft.useOtherWallet) && <p className="checkout-wallet-explanation">Escolha uma carteira cadastrada para preencher seus dados.</p>}{(!selected || draft.useOtherWallet) && (wallets.length ? <div className="checkout-wallets">{wallets.map((wallet) => <label key={wallet.id}><input type="radio" name="wallet" disabled={busy} checked={selected?.id === wallet.id} onChange={() => void choose(wallet, true)} /> {wallet.slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} — {wallet.nickname}</label>)}</div> : <p>Você ainda não cadastrou uma carteira. <a href="/wallets?returnTo=%2Fcheckout">Cadastrar carteira</a></p>)}<div className="checkout-fields">{([['displayName', 'Nome de exibição'], ['username', 'Nome de usuário'], ['network', 'Rede'], ['profileName', 'Nome do perfil'], ['address', 'Endereço da carteira'], ['secondaryAddress', 'ENS ou carteira secundária (opcional)'], ['walletType', 'Tipo de carteira'], ['referralCode', 'Código de indicação'], ['email', 'E-mail'], ['ensName', 'Nome ENS']] as const).map(([field, label]) => field === 'ensName' ? <div className="checkout-ens-field" key={field}><label htmlFor="checkout-ensName">{label}<span className="checkout-required" aria-hidden="true">*</span></label><div className="checkout-ens"><select aria-label="Sufixo ENS" disabled={busy} defaultValue=".eth"><option value=".eth">.eth</option></select><Input id="checkout-ensName" disabled={busy} aria-label="Nome ENS" aria-invalid={Boolean(fieldErrors.ensName)} aria-describedby={fieldErrors.ensName ? "checkout-error-ensName" : undefined} value={draft.collector.ensName ?? ''} onChange={(event) => change('ensName', event.target.value)} /></div>{fieldErrors.ensName && <span className="checkout-field-error" id="checkout-error-ensName">{fieldErrors.ensName}</span>}</div> : <label key={field} className={field === 'secondaryAddress' ? 'checkout-secondary-address' : undefined}><span className={field === 'secondaryAddress' ? 'checkout-secondary-label' : undefined}>{label}</span>{field !== 'secondaryAddress' && <span className="checkout-required" aria-hidden="true">*</span>}<Input id={`checkout-${field}`} placeholder={field === 'secondaryAddress' ? label : undefined} disabled={busy} ref={field === 'displayName' ? firstField : undefined} aria-invalid={Boolean(fieldErrors[field])} aria-describedby={fieldErrors[field] ? `checkout-error-${field}` : undefined} value={draft.collector[field] ?? ''} onChange={(event) => change(field, event.target.value)} readOnly={field === 'network' || field === 'walletType'} type={field === 'email' ? 'email' : 'text'} />{fieldErrors[field] && <span className="checkout-field-error" id={`checkout-error-${field}`}>{fieldErrors[field]}</span>}</label>)}<label className="checkout-other"><Checkbox className="checkout-checkbox" disabled={busy} checked={draft.useOtherWallet} onCheckedChange={(checked) => setDraft((current) => ({ ...current, useOtherWallet: checked === true }))} />Usar outra carteira?</label>{draft.useOtherWallet && <p className="checkout-other-help">Selecione uma carteira cadastrada acima ou <a href="/wallets?returnTo=%2Fcheckout">cadastre outra carteira</a>.</p>}<label className="checkout-note">Observação do colecionador (opcional)<textarea disabled={busy} value={draft.collector.note ?? ''} onChange={(event) => change('note', event.target.value)} /></label></div><button type="button" className="checkout-next" onClick={() => setStep(2)}>Continuar</button></section><section className={`checkout-summary ${step === 1 ? 'checkout-mobile-hidden' : ''}`}><button className="checkout-back" type="button" onClick={() => setStep(1)}>Voltar</button><div className="checkout-wallet-mobile"><div className="checkout-wallet-heading"><h2>Carteira conectada</h2><button type="button" disabled={busy || !selected} onClick={() => void changeWallet()}>Trocar carteira</button></div>{[...wallets].sort((a, b) => Number(a.slot === 'primary') - Number(b.slot === 'primary')).map((wallet) => <div className="checkout-wallet-card" key={wallet.id}><label><input type="radio" name="mobile-wallet" checked={selected?.id === wallet.id} disabled={busy} onChange={() => void choose(wallet)} /><span><strong>{wallet.nickname}</strong><small>{wallet.ensName ? `${wallet.ensName}.eth` : `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`}</small><small>{wallet.network === 'ethereum' ? 'Rede principal Ethereum' : wallet.network === 'polygon' ? 'Rede Polygon' : 'Rede Solana'}</small></span></label><details className="checkout-wallet-menu" onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary aria-label={`Opções da carteira ${wallet.nickname}`}><img src="/assets/icons/checkout-mobile-options-figma.svg" alt="" /></summary><div><a href="/wallets?returnTo=%2Fcheckout" onClick={(event) => { event.preventDefault(); void editWallet() }}>Editar</a><button type="button" disabled={busy || selected?.id !== wallet.id || !connection} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void disconnect() }}>Desconectar</button></div></details></div>)}</div><h2 className="checkout-summary-title">Seus NFTs</h2><div className="checkout-line-list" role="group" aria-label="NFTs no pagamento"><div className="checkout-line-heading"><span>NFTs</span><span>Subtotal</span></div>{cart.lines.map((line) => <div className="checkout-item" key={line.lineId}><img src={line.nft.artUrl} alt="" /><span className="checkout-item-details"><strong>{line.nft.name}</strong><small>ID do token: {line.nft.tokenId}</small></span><span className="checkout-item-quantity">(x {line.quantity})</span><strong className="checkout-item-total">{totals?.lines.find((item) => item.lineId === line.lineId)?.lineTotal ?? formatEth(lineTotal(line.unitPrice, line.quantity))} ETH</strong></div>)}<p className="checkout-coupon">{cart.couponCode ? `Cupom ${cart.couponCode} aplicado.` : 'Tem um código promocional?'} <a href="/cart">{cart.couponCode ? 'Alterar no carrinho' : 'Aplique aqui'}</a></p></div>{totals && <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{totals.subtotal} ETH</dd></div><div><dt>Desconto do lançamento</dt><dd>(−) {totals.discount}</dd></div><div><dt>Taxa de rede</dt><dd>{totals.networkFee} ETH<small>Taxa estimada</small></dd></div><div><dt>Total</dt><dd>{totals.total} ETH</dd></div></dl>}<h3>Carteira e rede</h3><fieldset className="checkout-providers"><legend className="checkout-sr">Provedor de carteira</legend>{([['walletconnect', 'WalletConnect', 'W'], ['metamask', 'MetaMask', 'M'], ['coinbase', 'Coinbase Wallet', '']] as const).map(([value, label, mark]) => <label key={value}><span className="checkout-provider-mark" aria-hidden="true">{mark || <span className="checkout-coinbase-icon"><span><img src="/assets/icons/checkout-mobile-wallet-figma.svg" alt="" /></span></span>}</span><span className={value === "walletconnect" ? "checkout-walletconnect-label" : undefined}>{label}</span>{value === "walletconnect" && <span className="checkout-walletconnect-chip" aria-hidden="true">METAMASK&nbsp; • &nbsp;WALLETCONNECT&nbsp; • &nbsp;COINBASE</span>}<input type="radio" name="provider" checked={provider === value} disabled={busy || !selected} onChange={() => void chooseProvider(value)} /></label>)}</fieldset>{connection ? <button type="button" disabled={busy} onClick={() => void disconnect()}>Desconectar carteira</button> : <button type="button" disabled={!selected || !ready || busy} onClick={() => void connect()}>Conectar carteira</button>}{connection && !validQuote && <button type="button" disabled={!ready || busy} onClick={() => void refreshQuote()}>Atualizar cotação</button>}<button type="button" className="checkout-review" disabled={busy} onClick={() => openReview()}>Revisar dados</button><Button className="checkout-submit" disabled={!connection || !validQuote || !ready || busy || !cart.lines.length}>Confirmar compra</Button></section></div></form>}{review && <ReviewDialog draft={draft} cart={cart} totals={totals} previous={previousQuote} selected={selected} reason={reviewReason} close={closeReview} />}</div><div className="checkout-footer"><Footer /></div></main>
}

function CheckoutContent() {
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const readinessRevision = useSyncExternalStore(subscribeCatalogReady, catalogReadinessRevision, () => 0)
  const cart = useQuery({ ...shoppingCartQueries.current(), enabled: ready })
  const wallets = useQuery({ ...accountQueries.wallets(), enabled: ready })
  if (!cart.data || !wallets.data) return <main className="checkout-page">{cart.isError || wallets.isError ? <p role="alert">Não foi possível carregar o pagamento. <button onClick={() => { void cart.refetch(); void wallets.refetch() }}>Tentar novamente</button></p> : <p role="status">Carregando pagamento...</p>}</main>
  return <CheckoutWorkspace key={sessionManager.session?.userId} cart={cart.data} wallets={wallets.data.items} ready={ready} readinessRevision={readinessRevision} />
}
export function CheckoutPage() {
  const session = useSyncExternalStore(subscribeSession, currentSession, () => null)
  const router = useRouter()
  useEffect(() => { if (!session) void router.navigate({ href: '/login?returnTo=%2Fcheckout', replace: true }) }, [router, session])
  return session ? <CheckoutContent /> : null
}
