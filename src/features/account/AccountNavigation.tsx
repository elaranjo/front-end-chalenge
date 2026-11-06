import { containDialogFocus } from '../../shared/dialog-focus.ts'
import { useEffect, useRef, useState } from 'react'

type Props = { active: 'profile' | 'wallets' | 'favorites'; onUnavailable: () => void; onLogout: () => void }

function MenuIcon({ name, source }: { name: 'wallet' | 'offers' | 'download' | 'support' | 'logout'; source: string }) {
  return <span className={`account-menu-icon account-menu-icon--${name}`} aria-hidden="true"><span className="account-menu-icon-inner"><span className="account-menu-icon-art"><img src={source} alt="" /></span></span></span>
}

function Menu({ active, onUnavailable, onLogout }: Props) {
  return <aside className="wallet-sidebar" aria-label="Navegação da conta"><h2>Meu perfil</h2><a href="/profile" aria-current={active === 'profile' ? 'page' : undefined}><img src={active === 'profile' ? '/assets/icons/profile-nav-user-figma.svg' : '/assets/icons/wallet-nav-user-figma.svg'} alt="" />Dados do perfil</a><a href="/wallets" aria-current={active === 'wallets' ? 'page' : undefined}><MenuIcon name="wallet" source={active === 'wallets' ? '/assets/icons/wallet-nav-wallet-figma.svg' : '/assets/icons/profile-nav-wallet-figma.svg'} />Carteiras</a><button type="button" onClick={onUnavailable}><img src={active === 'profile' ? '/assets/icons/profile-nav-activity-figma.svg' : '/assets/icons/wallet-nav-activity-figma.svg'} alt="" />Atividade</button><a href="/favorites" aria-current={active === 'favorites' ? 'page' : undefined}><img className="account-heart" src={active === 'favorites' ? '/assets/icons/account-favorites-active.svg' : '/assets/icons/wallet-nav-heart-figma.svg'} alt="" />Lista de interesse</a><button type="button" onClick={onUnavailable}><MenuIcon name="offers" source="/assets/icons/profile-nav-offers-figma.svg" />Ofertas</button><button type="button" onClick={onUnavailable}><MenuIcon name="download" source="/assets/icons/profile-nav-download-figma.svg" />Arquivos baixados</button><button type="button" onClick={onUnavailable}><MenuIcon name="support" source="/assets/icons/profile-nav-support-figma.svg" />Suporte</button><button type="button" onClick={onLogout}><MenuIcon name="logout" source="/assets/icons/profile-nav-logout-figma.svg" />Sair</button></aside>
}

function MobileMenu({ props, close }: { props: Props; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const current = dialog.current; if (current && !current.open) current.showModal(); return () => { if (current?.open) current.close() } }, [])
  function dismiss() { dialog.current?.close(); close() }
  return <dialog ref={dialog} className="account-menu-dialog" aria-label="Menu do perfil" onCancel={(event) => { event.preventDefault(); dismiss() }} onKeyDown={containDialogFocus}><button type="button" className="account-menu-close" autoFocus onClick={dismiss} aria-label="Fechar menu">×</button><Menu {...props} onUnavailable={() => { dismiss(); props.onUnavailable() }} onLogout={() => { dismiss(); props.onLogout() }} /></dialog>
}

export function AccountNavigation(props: Props) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  function close() { setOpen(false); trigger.current?.focus() }
  return <div className="account-navigation"><div className="account-navigation-desktop"><Menu {...props} /></div><button ref={trigger} className="account-menu-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Meu perfil</button>{open && <MobileMenu props={props} close={close} />}</div>
}
