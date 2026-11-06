import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const base = process.env.ACCESSIBILITY_BASE_URL ?? 'http://127.0.0.1:4173'
const axeScript = await readFile('node_modules/axe-core/axe.min.js', 'utf8')
const output = []
const browser = await chromium.launch({ headless: true })
try {
  for (const width of [390, 414, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width <= 414 ? 896 : 1080 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    async function auditCurrent(name) {
      await page.evaluate(() => document.fonts.ready)
      if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ content: axeScript })
      const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }))
      output.push({ page: name, width, violations: result.violations.map(({ id, impact, description, help, helpUrl, nodes }) => ({ id, impact, description, help, helpUrl, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })), incomplete: result.incomplete.map(({ id, impact, help, helpUrl, nodes }) => ({ id, impact, help, helpUrl, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) })
      console.log(`${width}px ${name}: ${result.violations.length} violações, ${result.incomplete.length} verificações manuais`)
    }
    async function audit(name, route, readySelector) {
      await page.goto(new URL(route, base).href)
      await page.locator(readySelector).first().waitFor({ state: 'visible' })
      await auditCurrent(name)
    }
    await audit('inicio', '/?mockScenario=visual-mobile', '.home-card')
    await audit('detalhe', '/nfts/emerald-ape-042', '.detail-title h1')
    await audit('carrinho', '/cart', '.cart-line')
    await audit('login', '/login?returnTo=%2Fprofile', '.auth-fields input')
    await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
    await page.locator('#auth-error-email').waitFor({ state: 'visible' })
    await auditCurrent('login-invalido')
    await audit('cadastro', '/signup?returnTo=%2Fprofile', '.auth-fields input')
    await page.getByRole('button', { name: width < 768 ? 'Criar perfil' : 'Criar conta', exact: true }).click()
    await page.locator('#auth-error-email').waitFor({ state: 'visible' })
    await auditCurrent('cadastro-invalido')
    await page.goto(new URL('/login?returnTo=%2Fprofile', base).href)
    await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.waitForURL('**/profile')
    await audit('perfil', '/profile', '.profile-form')
    await audit('carteiras', '/wallets', '.wallet-fields')
    await audit('checkout', '/checkout', '.checkout-fields')
    await page.evaluate(async () => {
      const token = localStorage.getItem('kurio.session-token')
      const wallet = { displayName: 'Colecionador', nickname: 'Principal', network: 'ethereum', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'colecionador' }
      const response = await fetch('/api/v1/wallets/primary', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'If-Match': '0' }, body: JSON.stringify(wallet) })
      if (!response.ok) throw new Error(`Falha ao preparar carteira: ${response.status}`)
    })
    await page.reload()
    await page.getByLabel(/Carteira principal — Principal/).click()
    if (width < 1280) await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('.checkout-submit')?.disabled)
    await auditCurrent('checkout-conectado')
    await page.getByRole('button', { name: 'Revisar dados' }).click()
    await page.getByRole('dialog', { name: 'Revisão dos dados' }).waitFor({ state: 'visible' })
    await auditCurrent('checkout-revisao')
    await page.getByRole('dialog', { name: 'Revisão dos dados' }).getByRole('button', { name: 'Fechar' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }).waitFor({ state: 'visible', timeout: 20000 })
    await auditCurrent('recibo')
    await audit('carrinho-vazio', '/cart', '.cart-empty')
    await context.close()
  }
} finally {
  await browser.close()
}
await mkdir('reports/accessibility', { recursive: true })
await writeFile('reports/accessibility/axe.json', JSON.stringify({ generatedAt: new Date().toISOString(), base, axeVersion: JSON.parse(await readFile('node_modules/axe-core/package.json', 'utf8')).version, scope: 'WCAG 2 A/AA and 2.1 A/AA automated rules; manual review and other screens remain required', results: output }, null, 2) + '\n')
console.log(`Relatório: reports/accessibility/axe.json`)
const violations = output.reduce((count, result) => count + result.violations.length, 0)
if (violations) {
  console.error(`Auditoria encontrou ${violations} ocorrência(s) de regras violadas; consulte o relatório.`)
  process.exitCode = 1
}
