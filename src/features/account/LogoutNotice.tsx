import { useEffect, useState } from 'react'
import { sessionManager } from '../../app/session.ts'

export function LogoutNotice() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const show = () => setVisible(true)
    window.addEventListener('kurio:logout-unconfirmed', show)
    const unsubscribe = sessionManager.subscribe((session) => { if (session) setVisible(false) })
    return () => { window.removeEventListener('kurio:logout-unconfirmed', show); unsubscribe() }
  }, [])
  if (!visible) return null
  return <aside role="alert" className="cart-merge-notice">A sessão local foi encerrada, mas não foi possível confirmar o encerramento no servidor simulado. <button type="button" onClick={() => setVisible(false)}>Fechar</button></aside>
}
