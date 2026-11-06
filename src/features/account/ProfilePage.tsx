import { AccountNavigation } from './AccountNavigation.tsx'
import { AccountHeader } from './AccountHeader.tsx'
import { useEffect, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import axios from 'axios'
import { accountQueries } from '../../app/private-queries.ts'
import { catalogReady, subscribeCatalogReady } from '../../app/catalog-queries.ts'
import { logoutWithFeedback, sessionManager } from '../../app/session.ts'
import type { Profile } from '../../shared/contracts.ts'
import type { ProfileChanges } from '../../shared/profile-client.ts'
import './wallets.css'
import './profile.css'

const subscribeSession = (listener: () => void) => sessionManager.subscribe(listener)
const currentSession = () => sessionManager.session

type Fields = Omit<ProfileChanges, 'passwordChange'>
function ProfileWorkspace({ initial, ready }: { initial: Profile; ready: boolean }) {
  const router = useRouter()
  const [fields, setFields] = useState<Fields>(() => ({ displayName: initial.displayName, username: initial.username, email: initial.email, ensName: initial.ensName, walletNickname: initial.walletNickname }))
  const [version, setVersion] = useState(initial.version)
  const [avatarVersion, setAvatarVersion] = useState(initial.version)
  const [hasAvatar, setHasAvatar] = useState(Boolean(initial.avatarUrl))
  const [storedAvatar, setStoredAvatar] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<Blob | null | undefined>(undefined)
  const [preview, setPreview] = useState<string | null>(null)
  const [password, setPassword] = useState({ current: '', new: '', confirmation: '' })
  const [shown, setShown] = useState({ current: false, new: false, confirmation: false })
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!hasAvatar) return
    let active = true
    let url: string | undefined
    const controller = new AbortController()
    void import('../../app/marketplace-services.ts').then(({ profile }) => profile.avatar(controller.signal)).then((blob) => {
      if (active) { url = URL.createObjectURL(blob); setStoredAvatar(url) }
    }).catch(() => { if (active) setMessage('Não foi possível carregar o avatar salvo.') })
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [hasAvatar, avatarVersion])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setErrors((current) => ({ ...current, avatar: 'Escolha uma imagem PNG, JPEG ou WebP de até 2 MiB.' })); return }
    setErrors((current) => ({ ...current, avatar: '' })); setAvatar(file); setPreview(URL.createObjectURL(file))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !ready) return
    const next: Record<string, string> = {}
    if (errors.avatar) next.avatar = errors.avatar
    if (!fields.displayName.trim()) next.displayName = 'Informe o nome de exibição.'
    if (!fields.username.trim()) next.username = 'Informe o nome de usuário.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) next.email = 'Informe um e-mail válido.'
    if (fields.ensName && !/^[a-zA-Z0-9-]+$/.test(fields.ensName)) next.ensName = 'Informe um nome ENS válido.'
    const changing = Object.values(password).some(Boolean)
    if (changing && (!password.current || !password.new || !password.confirmation || password.new !== password.confirmation)) next.passwordChange = 'Preencha os três campos e confirme a nova senha.'
    if (Object.keys(next).length) { setErrors(next); setMessage('Confira os campos destacados.'); return }
    setBusy(true); setErrors({}); setMessage('')
    try {
      const { profile } = await import('../../app/marketplace-services.ts')
      const saved = await profile.save({ ...fields, ...(changing ? { passwordChange: password } : {}) }, version, avatar)
      setVersion(saved.version); setHasAvatar(Boolean(saved.avatarUrl)); setAvatarVersion(saved.version); setAvatar(undefined); setPreview(null)
      setPassword({ current: '', new: '', confirmation: '' }); setMessage('Perfil salvo.')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const received = error.response?.data?.error?.fieldErrors ?? {}
        setErrors({ ...received, ...(received.currentPassword ? { passwordChange: received.currentPassword } : {}) })
        setMessage(error.response?.data?.error?.message ?? 'Não foi possível salvar o perfil.')
      }
      else setMessage('Não foi possível salvar o perfil. Tente novamente.')
    } finally { setBusy(false) }
  }
  async function logout() { await logoutWithFeedback(() => router.navigate({ href: '/' })) }
  const avatarSrc = avatar === null ? null : avatar instanceof Blob ? preview : hasAvatar ? storedAvatar : null
  return <main className="wallet-page"><AccountHeader /><div className="wallet-layout"><AccountNavigation active="profile" onUnavailable={() => setMessage('Esta opção não está disponível nesta demonstração.')} onLogout={() => void logout()} /><div className="wallet-main"><div className="wallet-heading"><h1>Perfil do colecionador</h1></div><form className="profile-form" onSubmit={(event) => void save(event)} noValidate><div className="profile-top"><div className="profile-fields">{([['displayName', 'Nome de exibição'], ['username', 'Nome de usuário'], ['email', 'E-mail'], ['ensName', 'Nome ENS'], ['walletNickname', 'Apelido da carteira']] as const).map(([key, label]) => <div className="profile-field" key={key}><label htmlFor={`profile-${key}`}>{label}<span className="profile-required" aria-hidden="true">*</span></label><span className={key === 'ensName' ? 'profile-ens' : undefined}>{key === 'ensName' && <select aria-label="Sufixo ENS" defaultValue=".eth"><option value=".eth">.eth</option></select>}<input id={`profile-${key}`} type={key === 'email' ? 'email' : 'text'} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `profile-error-${key}` : undefined} /></span>{errors[key] && <span id={`profile-error-${key}`} className="profile-error">{errors[key]}</span>}</div>)}</div><div className="profile-avatar"><span className="profile-avatar-label">Avatar</span>{avatarSrc ? <img src={avatarSrc} alt="Avatar do perfil" /> : <div role="img" aria-label="Sem avatar" className="profile-avatar-placeholder"><span className="profile-avatar-icon" aria-hidden="true"><img src="/assets/icons/profile-avatar-figma.svg" alt="" /></span></div>}<label className="profile-avatar-change">Alterar<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} /></label><button type="button" onClick={() => { setAvatar(null); setPreview(null); setErrors((current) => ({ ...current, avatar: '' })) }}>Remover</button>{errors.avatar && <span className="profile-error" role="alert">{errors.avatar}</span>}</div></div><h2>Alterar senha</h2><div className="profile-passwords">{([['current', 'Senha atual'], ['new', 'Nova senha'], ['confirmation', 'Confirmar nova senha']] as const).map(([key, label]) => <label key={key}>{label}<span className="profile-password"><input aria-label={label} type={shown[key] ? 'text' : 'password'} value={password[key]} autoComplete={key === 'current' ? 'current-password' : 'new-password'} onChange={(event) => setPassword({ ...password, [key]: event.target.value })} aria-invalid={Boolean(errors.passwordChange)} aria-describedby={errors.passwordChange ? 'profile-password-error' : undefined} /><button type="button" aria-label={`${shown[key] ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} onClick={() => setShown({ ...shown, [key]: !shown[key] })}><span className="profile-password-icon" aria-hidden="true"><img src="/assets/icons/profile-hide-figma.svg" alt="" /></span></button></span></label>)}</div>{errors.passwordChange && <p id="profile-password-error" className="profile-error">{errors.passwordChange}</p>}{message && <p role={Object.values(errors).some(Boolean) ? 'alert' : 'status'}>{message}</p>}<button className="wallet-save" disabled={busy || !ready} type="submit">{busy ? 'Salvando...' : 'Salvar'}</button></form></div></div></main>
}
function ProfileContent() {
  const ready = useSyncExternalStore(subscribeCatalogReady, catalogReady, () => false)
  const profile = useQuery({ ...accountQueries.profile(), enabled: ready })
  if (!profile.data && (!ready || profile.isPending)) return <main className="wallet-page"><p role="status">Carregando perfil...</p></main>
  if (!profile.data) return <main className="wallet-page"><p role="alert">Não foi possível carregar o perfil.</p><button onClick={() => void profile.refetch()}>Tentar novamente</button></main>
  return <ProfileWorkspace key={sessionManager.session?.userId} initial={profile.data} ready={ready} />
}
export function ProfilePage() {
  const session = useSyncExternalStore(subscribeSession, currentSession, () => null)
  const router = useRouter()
  useEffect(() => { if (!session) void router.navigate({ href: '/login?returnTo=%2Fprofile', replace: true }) }, [router, session])
  return session ? <ProfileContent /> : null
}
