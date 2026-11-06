import { useState, type FormEvent } from 'react'
import './footer.css'

const features = [
  { mark: 'W', title: 'Segurança da carteira', description: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { mark: 'C', title: 'Criadores em destaque', description: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { mark: 'D', title: 'Alertas de lançamentos', description: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]
const help = ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item']
const categories = ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade']
export function Footer() {
  const [email, setEmail] = useState('')
  const [newsletterMessage, setNewsletterMessage] = useState('')
  const [notice, setNotice] = useState('')
  function unavailable() { setNotice('Esta opção não está disponível nesta demonstração.') }
  function newsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) { setNewsletterMessage('Informe um e-mail válido.'); return }
    setNewsletterMessage('O envio de novidades não está disponível nesta demonstração.')
  }
  return <footer className="site-footer" role="contentinfo"><section className="footer-features" aria-label="Sobre a Kurio">{features.map((feature) => <article key={feature.mark}><span className="footer-medallion" aria-hidden="true">{feature.mark}</span><h2>{feature.title}</h2><p>{feature.description}</p></article>)}<div className="footer-newsletter"><h2>Antecipe-se ao próximo lançamento</h2><form onSubmit={newsletter} noValidate><label htmlFor="footer-email" className="footer-visually-hidden">E-mail para novidades</label><input id="footer-email" type="email" required placeholder="digite seu e-mail..." value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby={newsletterMessage ? 'footer-newsletter-message' : undefined} /><button type="submit">Enviar</button></form><p>Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>{newsletterMessage && <p id="footer-newsletter-message" role="status">{newsletterMessage}</p>}</div></section><div className="footer-brand"><strong>KURIO</strong><p>Feito para colecionadores,<br />criadores e cultura</p><span>contato@email.com</span><span>+55 11 4002 8922</span></div><div className="footer-links"><section><h2>Meu perfil</h2><a href="/profile">Meu perfil</a><button onClick={unavailable}>Minha coleção</button><button onClick={unavailable}>Atividade</button><button onClick={unavailable}>Estúdio do criador</button><a href="/favorites">Lista de interesse</a></section><section><h2>Central de ajuda</h2>{help.map((item) => <button key={item} onClick={unavailable}>{item}</button>)}</section><section><h2>Coleções</h2>{categories.map((category) => <a href={`/?${new URLSearchParams({ category })}#catalogo`} key={category}>{category}</a>)}</section><section className="footer-social"><h2>Redes sociais</h2><div>{[['Facebook', 'facebook'], ['Instagram', 'instagram'], ['Twitter', 'twitter'], ['LinkedIn', 'linkedin'], ['YouTube', 'youtube']].map(([social, icon]) => <button type="button" key={social} aria-label={social} onClick={unavailable}><img src={`/assets/icons/footer-${icon}-figma.svg`} alt="" /></button>)}</div><h2>Carteiras compatíveis</h2><p>METAMASK  •  WALLETCONNECT  •  COINBASE</p></section></div>{notice && <p className="footer-notice" role="status">{notice}</p>}<p className="footer-copyright">© 2026 Kurio. Propriedade digital para todos.</p></footer>
}
