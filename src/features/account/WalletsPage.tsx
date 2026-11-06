import { AccountNavigation } from './AccountNavigation.tsx'
import { AccountHeader } from './AccountHeader.tsx'
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import axios from 'axios'
import { accountQueries } from '../../app/private-queries.ts'
import { catalogReady, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { logoutWithFeedback, sessionManager } from '../../app/session.ts'
import type { Wallet } from '../../shared/contracts.ts'
import type { WalletInput } from '../../shared/wallet-client.ts'
import './wallets.css'

type Draft = Omit<WalletInput, 'network' | 'type'> & { network: Wallet['network'] | ''; type: Wallet['type'] | '' }
const empty = (): Draft => ({ displayName: '', nickname: '', network: '', profileName: '', address: '', secondaryAddress: '', type: '', referralCode: '', email: '', ensName: '' })
const fromWallet = (wallet?: Wallet): Draft => wallet ? { displayName: wallet.displayName, nickname: wallet.nickname, network: wallet.network, profileName: wallet.profileName, address: wallet.address, secondaryAddress: wallet.secondaryAddress ?? '', type: wallet.type, referralCode: wallet.referralCode, email: wallet.email, ensName: wallet.ensName } : empty()

function WalletForm({ title, draft, setDraft, revision, slot, firstInputRef }: { title: string; draft: Draft; setDraft: (draft: Draft) => void; revision: number; slot: Wallet['slot']; firstInputRef?: Ref<HTMLInputElement> }) {
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const change = (field: keyof Draft, value: string) => { setDraft({ ...draft, [field]: value }); setErrors((current) => ({ ...current, [field]: '' })); setMessage('') }
  const inputProps = (field: keyof Draft, label: string) => ({ 'aria-label': label, 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${slot}-error-${field}` : undefined })
  const fieldError = (field: keyof Draft) => errors[field] ? <span className="wallet-field-error" id={`${slot}-error-${field}`}>{errors[field]}</span> : null
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const next: Record<string, string> = {}
    for (const [field, label] of [['displayName', 'nome de exibição'], ['nickname', 'apelido da carteira'], ['profileName', 'nome do perfil'], ['referralCode', 'código de indicação']] as const) if (!draft[field].trim()) next[field] = `Informe o ${label}.`
    if (!draft.network) next.network = 'Selecione uma rede.'
    if (!draft.type) next.type = 'Selecione um tipo de carteira.'
    if (!/^0x[0-9a-fA-F]{40}$/.test(draft.address)) next.address = 'Informe um endereço 0x com 40 caracteres hexadecimais.'
    if (!/^[a-zA-Z0-9-]+$/.test(draft.ensName)) next.ensName = 'Informe um nome ENS válido.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) next.email = 'Informe um e-mail válido.'
    if (Object.keys(next).length) { setErrors(next); setMessage('Confira os campos destacados.'); return }
    if (!draft.network || !draft.type) return
    setBusy(true); setErrors({}); setMessage('')
    try {
      const { wallets } = await import('../../app/marketplace-services.ts')
      await wallets.save(slot, { ...draft, network: draft.network, type: draft.type }, revision)
      setMessage('Carteira salva.')
    } catch (error) {
      const received: unknown = axios.isAxiosError(error) ? error.response?.data?.error?.fieldErrors : undefined
      if (received && typeof received === 'object') setErrors(Object.fromEntries(Object.entries(received).filter((entry): entry is [string, string] => typeof entry[1] === 'string')))
      setMessage(axios.isAxiosError(error) && typeof error.response?.data?.error?.message === 'string' ? error.response.data.error.message : 'Não foi possível salvar a carteira. Confira os dados e tente novamente.')
    }
    finally { setBusy(false) }
  }
  return <form className="wallet-form" onSubmit={save} noValidate aria-label={title}>
    <div className="wallet-fields">
      <label>Nome de exibição<span>*</span><input ref={firstInputRef} required {...inputProps('displayName', 'Nome de exibição')} value={draft.displayName} onChange={(e) => change('displayName', e.target.value)} />{fieldError('displayName')}</label>
      <label>Apelido da carteira<span>*</span><input required {...inputProps('nickname', 'Apelido da carteira')} value={draft.nickname} onChange={(e) => change('nickname', e.target.value)} />{fieldError('nickname')}</label>
      <label>Rede <span>*</span><select required {...inputProps('network', 'Rede')} value={draft.network} onChange={(e) => change('network', e.target.value)}><option value="">Selecione uma rede</option><option value="ethereum">Ethereum</option><option value="polygon">Polygon</option><option value="solana">Solana</option></select>{fieldError('network')}</label>
      <label>Nome do perfil<span>*</span><input required {...inputProps('profileName', 'Nome do perfil')} value={draft.profileName} onChange={(e) => change('profileName', e.target.value)} />{fieldError('profileName')}</label>
      <label>Endereço da carteira<span>*</span><input required placeholder="Endereço 0x da carteira" {...inputProps('address', 'Endereço da carteira')} value={draft.address} onChange={(e) => change('address', e.target.value)} />{fieldError('address')}</label>
      <label><span className="wallet-sr">ENS ou carteira secundária (opcional)</span><input placeholder="ENS ou carteira secundária (opcional)" {...inputProps('secondaryAddress', 'ENS ou carteira secundária (opcional)')} value={draft.secondaryAddress ?? ''} onChange={(e) => change('secondaryAddress', e.target.value)} />{fieldError('secondaryAddress')}</label>
      <label>Tipo de carteira<span>*</span><select required {...inputProps('type', 'Tipo de carteira')} value={draft.type} onChange={(e) => change('type', e.target.value)}><option value="">Selecione uma carteira</option><option value="walletconnect">WalletConnect</option><option value="metamask">MetaMask</option><option value="coinbase">Coinbase Wallet</option></select>{fieldError('type')}</label>
      <label>Código de indicação<span>*</span><input required {...inputProps('referralCode', 'Código de indicação')} value={draft.referralCode} onChange={(e) => change('referralCode', e.target.value)} />{fieldError('referralCode')}</label>
      <label>E-mail<span>*</span><input required type="email" {...inputProps('email', 'E-mail')} value={draft.email} onChange={(e) => change('email', e.target.value)} />{fieldError('email')}</label>
      <div className="wallet-ens-field"><label htmlFor={`${slot}-ens-name`}>Nome ENS <span>*</span></label><div className="wallet-ens"><select aria-label="Sufixo ENS" defaultValue=".eth"><option value=".eth">.eth</option></select><input id={`${slot}-ens-name`} required {...inputProps('ensName', 'Nome ENS')} value={draft.ensName} onChange={(e) => change('ensName', e.target.value)} /></div>{fieldError('ensName')}</div>
    </div>
    {message && <p role={Object.values(errors).some(Boolean) || message !== 'Carteira salva.' ? 'alert' : 'status'}>{message}</p>}
    <button className="wallet-save" disabled={busy} type="submit">{busy ? 'Salvando...' : 'Salvar carteira'}</button>
  </form>
}

function WalletWorkspace({ items }: { items: Wallet[] }) {
  const primary = items.find((item) => item.slot === 'primary')
  const secondary = items.find((item) => item.slot === 'secondary')
  const [mainDraft, setMainDraft] = useState(() => fromWallet(primary))
  const [secondaryDraft, setSecondaryDraft] = useState(() => fromWallet(secondary))
  const [showSecondary, setShowSecondary] = useState(Boolean(secondary))
  const [notice, setNotice] = useState('')
  const firstInput = useRef<HTMLInputElement>(null)
  const router = useRouter()
  async function logout() { await logoutWithFeedback(() => router.navigate({ href: '/' })) }
  return <main className="wallet-page"><AccountHeader /><div className="wallet-layout"><AccountNavigation active="wallets" onUnavailable={() => setNotice('Esta opção não está disponível nesta demonstração.')} onLogout={() => void logout()} /><div className="wallet-main">{new URLSearchParams(window.location.search).get('returnTo') === '/checkout' && <a href="/checkout">Voltar ao pagamento</a>}<div className="wallet-heading"><h1>Carteira principal</h1><button type="button" onClick={() => firstInput.current?.focus()}>Adicionar</button></div><p>Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>{notice && <p role="status">{notice}</p>}<WalletForm title="Carteira principal" draft={mainDraft} setDraft={setMainDraft} revision={primary?.version ?? 0} slot="primary" firstInputRef={firstInput} /><div className="wallet-heading wallet-secondary"><h2>Carteira secundária</h2><div><button type="button" className="wallet-copy" onClick={() => { setSecondaryDraft({ ...mainDraft }); setShowSecondary(true) }}>Igual à carteira principal</button><button type="button" onClick={() => setShowSecondary(!showSecondary)}>{showSecondary ? 'Recolher' : 'Adicionar'}</button></div></div>{showSecondary ? <WalletForm title="Carteira secundária" draft={secondaryDraft} setDraft={setSecondaryDraft} revision={secondary?.version ?? 0} slot="secondary" /> : <p>Você ainda não adicionou uma carteira secundária.</p>}</div></div></main>
}

function WalletsContent() {
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const wallets = useQuery({ ...accountQueries.wallets(), enabled: ready })
  if (!wallets.data && (!ready || wallets.isPending)) return <main className="wallet-page"><p role="status">Carregando carteiras...</p></main>
  if (!wallets.data) return <main className="wallet-page"><p role="alert">Não foi possível carregar as carteiras.</p><button onClick={() => void wallets.refetch()}>Tentar novamente</button></main>
  return <WalletWorkspace key={sessionManager.session?.userId} items={wallets.data.items} />
}

const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const currentSession = () => sessionManager.session
export function WalletsPage() {
  const session = useSyncExternalStore(subscribeSession, currentSession, () => null)
  const router = useRouter()
  useEffect(() => { if (!session) void router.navigate({ href: '/login?returnTo=%2Fwallets', replace: true }) }, [router, session])
  return session ? <WalletsContent /> : null
}
