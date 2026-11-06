import { containDialogFocus } from '../../shared/dialog-focus.ts'
import { Input } from '../../components/ui/input.tsx'
import { Button } from '../../components/ui/button.tsx'
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import axios from 'axios'
import { authFlow } from '../../app/session.ts'
import { queryClient } from '../../app/query-client.ts'
import { CartMergePending } from '../../shared/auth-flow.ts'
import { safeReturnTo } from '../../shared/safe-return.ts'
import { clearFavoriteFocus, prepareFavoriteFocus } from '../../shared/auth-favorite-focus.ts'
import { HomePage } from '../catalog/HomePage.tsx'
import './auth.css'

type Props = { mode: 'login' | 'signup' }
const desktopMedia = window.matchMedia('(min-width: 768px)')
const subscribeDesktop = (listener: () => void) => { desktopMedia.addEventListener('change', listener); return () => desktopMedia.removeEventListener('change', listener) }
const isDesktop = () => desktopMedia.matches

function DesktopAuth({ children, close }: { children: ReactNode; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const current = dialog.current; if (current && !current.open) current.showModal(); return () => { if (current?.open) current.close() } }, [])
  function dismiss() {
    if (sessionStorage.getItem('kurio.auth-home-focus') === 'pending') sessionStorage.setItem('kurio.auth-home-focus', 'restore')
    dialog.current?.close(); close()
  }
  return <><div className="auth-background"><HomePage background /></div><dialog ref={dialog} className="auth-page auth-desktop-dialog" aria-label="Autenticação" onCancel={(event) => { event.preventDefault(); dismiss() }} onKeyDown={containDialogFocus}><button className="auth-close" type="button" aria-label="Fechar" autoFocus onClick={dismiss}><img src="/assets/icons/auth-close.svg" alt="" /></button>{children}</dialog></>
}

export function AuthPage({ mode }: Props) {
  const signup = mode === 'signup'
  const router = useRouter()
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false)
  const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'))
  const switchHref = `/${signup ? 'login' : 'signup'}?${new URLSearchParams({ returnTo })}`
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mergePending, setMergePending] = useState(() => authFlow.hasPendingMerge())
  const [adjustments, setAdjustments] = useState<Array<{ nftId: string; editionId: string; requested: number; accepted: number }>>([])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const fieldProps = (key: string) => ({ 'aria-invalid': Boolean(fieldErrors[key]), 'aria-describedby': fieldErrors[key] ? `auth-error-${key}` : undefined })
  const fieldError = (key: string) => fieldErrors[key] ? <span className="auth-field-error" id={`auth-error-${key}`}>{fieldErrors[key]}</span> : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(''); setFieldErrors({})
    if (!mergePending && (!email.trim() || !password || (signup && !username.trim()))) { setFieldErrors({ ...(!email.trim() ? { email: 'Informe o e-mail.' } : {}), ...(!password ? { password: 'Informe a senha.' } : {}), ...(signup && !username.trim() ? { username: 'Informe o nome de usuário.' } : {}) }); setError('Preencha os campos obrigatórios.'); return }
    if (!mergePending && !event.currentTarget.querySelector<HTMLInputElement>('input[type="email"]')?.validity.valid) { setFieldErrors({ email: 'Informe um e-mail válido.' }); setError('Informe um e-mail válido.'); return }
    if (!mergePending && signup && password !== confirmation) { setFieldErrors({ passwordConfirmation: 'As senhas não coincidem.' }); setError('As senhas não coincidem.'); return }
    setBusy(true)
    try {
      const result = mergePending ? await authFlow.retryMerge() : signup ? await authFlow.signup(username.trim(), email.trim(), password, confirmation) : await authFlow.login(email.trim(), password)
      clearFavoriteFocus()
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      setPassword(''); setConfirmation(''); setMergePending(false)
      if (result.adjustments.length) setAdjustments(result.adjustments)
      else await router.navigate({ href: returnTo })
    } catch (failure) {
      if (failure instanceof CartMergePending) {
        setPassword(''); setConfirmation(''); setMergePending(true)
        setError('Não foi possível sincronizar o carrinho. Tente novamente.')
      } else if (axios.isAxiosError(failure)) {
        const errors: unknown = failure.response?.data?.error?.fieldErrors
        if (errors && typeof errors === 'object') setFieldErrors(Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string] => typeof entry[1] === 'string')))
        setError(failure.response?.data?.error?.message || 'Não foi possível concluir. Tente novamente.')
      } else setError('Não foi possível concluir. Tente novamente.')
    } finally { setBusy(false) }
  }

  const unavailable = () => setError('Esta opção não está disponível nesta demonstração.')
  const content = <div className={`auth-content ${signup ? 'auth-signup-content' : ''}`}>
      <a className="auth-logo" href="/" aria-label="Kurio — início">KURIO</a>
      <nav className="auth-desktop-tabs" aria-label="Autenticação"><a href={signup ? switchHref : undefined} aria-current={!signup ? 'page' : undefined}>Entrar</a><span aria-hidden="true" /><a href={signup ? undefined : switchHref} aria-current={signup ? 'page' : undefined}>Criar conta</a></nav>
      <p className="auth-desktop-description">{signup ? 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.' : 'Entre para gerenciar sua carteira, coleção e perfil de criador.'}</p>
      <h1>{signup ? 'Criar perfil de colecionador' : 'Entrar'}</h1>
      {adjustments.length > 0 ? <section role="status" aria-label="Ajustes do carrinho"><p>Alguns itens tiveram a quantidade ajustada conforme o estoque disponível:</p><ul>{adjustments.map((item) => <li key={`${item.nftId}:${item.editionId}`}>{item.nftId} · {item.editionId}: {item.accepted} de {item.requested} adicionados</li>)}</ul><button type="button" className="auth-submit" onClick={() => void router.navigate({ href: returnTo })}>Continuar</button></section> : <form onSubmit={submit} noValidate>
        <div className="auth-fields">
          {signup && <label><span className="auth-visually-hidden">Nome de usuário</span><Input aria-label="Nome de usuário" className="auth-username" {...fieldProps('username')} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Nome de usuário" autoComplete="username" required />{fieldError('username')}</label>}
          <label><span className="auth-visually-hidden">E-mail</span><Input aria-label="E-mail" type="email" {...fieldProps('email')} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={signup ? 'Digite seu e-mail' : 'contato@email.com'} autoComplete="email" required />{fieldError('email')}</label>
          <label className="auth-password"><span className="auth-visually-hidden">Senha</span><Input aria-label="Senha" {...fieldProps('password')} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={signup ? 'Senha' : '***********'} autoComplete={signup ? 'new-password' : 'current-password'} required /><button type="button" className="auth-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}><span className="auth-password-icon" aria-hidden="true"><span><img src={`/assets/icons/auth-${desktop ? 'desktop' : 'mobile'}-signup-hide-figma.svg`} alt="" /></span></span></button>{fieldError('password')}</label>
          {signup && <label className="auth-password"><span className="auth-visually-hidden">Confirmar senha</span><Input aria-label="Confirmar senha" {...fieldProps('passwordConfirmation')} type={showConfirmation ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirmar senha" autoComplete="new-password" required /><button type="button" className="auth-toggle" onClick={() => setShowConfirmation(!showConfirmation)} aria-label={showConfirmation ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}><span className="auth-password-icon" aria-hidden="true"><span><img src={`/assets/icons/auth-${desktop ? 'desktop' : 'mobile'}-signup-hide-figma.svg`} alt="" /></span></span></button>{fieldError('passwordConfirmation')}</label>}
        </div>
        {!signup && <button className="auth-forgot" type="button" onClick={unavailable}>Esqueceu a senha?</button>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Aguarde...' : mergePending ? 'Tentar novamente' : signup ? (desktop ? 'Criar conta' : 'Criar perfil') : 'Entrar'}</Button>
      </form>}
      <div className="auth-social"><div className="auth-divider"><span>Ou continue com</span></div><button type="button" onClick={unavailable}><span className="auth-google-desktop" aria-hidden="true">{[244, 245, 249, 251, 252, 253, 254].map((node) => <img key={node} className={`auth-google-${node}`} src={`/assets/icons/google-desktop-${node}.svg`} alt="" />)}</span>Continuar com Google</button><button type="button" onClick={unavailable}><img src={`/assets/icons/${desktop ? (signup ? 'context-434d15ce624cf881' : 'context-989807e1d00ec515') : (signup ? 'context-96a93ad0e8b8aa42' : 'context-0445e8ea7de3d164')}.svg`} alt="" />Continuar com Facebook</button></div>
      <a className="auth-switch" href={switchHref}>{signup ? 'Já tem uma conta? Entre' : 'Novo na Kurio? Crie uma conta'}</a>
    </div>
  const closeDestination = /^\/(checkout|profile|wallets|favorites|orders)(?:[/?#]|$)/.test(returnTo) ? '/' : returnTo
  return desktop ? <DesktopAuth close={() => {
    prepareFavoriteFocus(closeDestination)
    const marker = sessionStorage.getItem('kurio.auth-account-focus')
    if (marker === `pending:${closeDestination}`) sessionStorage.setItem('kurio.auth-account-focus', `restore:${closeDestination}`)
    else sessionStorage.removeItem('kurio.auth-account-focus')
    void router.navigate({ href: closeDestination })
  }}>{content}</DesktopAuth> : <main className={`auth-page ${signup ? 'auth-signup' : 'auth-login'}`}>{content}</main>
}
