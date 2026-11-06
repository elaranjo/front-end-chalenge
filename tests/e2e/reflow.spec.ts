import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 320, height: 844 } })

for (const width of [390, 414]) {
  test(`a barra móvel não encobre o fim do rodapé em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('http://127.0.0.1:5173/')
    await expect(page.locator('.home-card').first()).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const footer = await page.locator('.footer-copyright').boundingBox()
    const navigation = await page.getByRole('navigation', { name: 'Navegação mobile' }).boundingBox()
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(navigation!.y + 1)
  })
}

test('detalhe mantém edição e compra alcançáveis em viewport baixo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 })
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  const edition = page.getByRole('button', { name: '1/50', exact: true })
  await expect(edition).toBeVisible()
  await edition.focus()
  await expect(edition).toBeFocused()
  expect(await edition.evaluate((element) => { const rect = element.getBoundingClientRect(); const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return hit === element || element.contains(hit) })).toBe(true)
  const purchase = page.getByRole('button', { name: 'Comprar NFT', exact: true })
  await purchase.focus()
  await expect(purchase).toBeFocused()
  expect(await purchase.evaluate((element) => { const rect = element.getBoundingClientRect(); const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return hit === element || element.contains(hit) })).toBe(true)
})

for (const entry of [
  { name: 'home', path: '/', selector: 'a[href="/nfts/emerald-ape-042"]' },
  { name: 'detalhe', path: '/nfts/emerald-ape-042', selector: 'button:has-text("Comprar NFT")' },
  { name: 'carrinho', path: '/cart?mockScenario=visual-mobile', selector: 'button:has-text("Conectar e finalizar")' },
  { name: 'login', path: '/login', selector: 'button:has-text("Entrar")' },
  { name: 'cadastro', path: '/signup', selector: 'button:has-text("Criar perfil")' },
]) {
  test(`${entry.name} mantém conteúdo e ação principal alcançáveis em 320 px`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:5173${entry.path}`)
    const action = page.locator(entry.selector).first()
    await expect(action).toBeVisible()
    await action.scrollIntoViewIfNeeded()
    const bounds = await action.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })
}

test('pagamento e recibo confirmado mantêm ações alcançáveis em 320 px', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await page.evaluate(async () => {
    const token = localStorage.getItem('kurio.session-token')!
    const wallet = { displayName: 'Colecionador', nickname: 'Principal', network: 'ethereum', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'colecionador' }
    const response = await fetch('/api/v1/wallets/primary', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'If-Match': '0' }, body: JSON.stringify(wallet) })
    if (!response.ok) throw new Error(`Carteira: ${response.status}`)
  })
  await page.reload()
  await page.getByLabel(/Carteira principal — Principal/).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  const confirm = page.getByRole('button', { name: 'Confirmar compra', exact: true })
  await expect(confirm).toBeEnabled()
  await confirm.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  const confirmBounds = await confirm.boundingBox()
  expect(confirmBounds!.x).toBeGreaterThanOrEqual(0)
  expect(confirmBounds!.x + confirmBounds!.width).toBeLessThanOrEqual(320)
  await page.getByRole('button', { name: 'Revisar dados' }).click()
  const review = page.getByRole('dialog', { name: 'Revisão dos dados' })
  await expect(review.getByText('Taxa de rede')).toBeVisible()
  await review.getByRole('button', { name: 'Fechar' }).click()
  await confirm.click()
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.order-item')).toHaveCount(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  const close = page.getByRole('button', { name: 'Fechar recibo', exact: true })
  await close.scrollIntoViewIfNeeded()
  await expect(close).toBeVisible()
  const bounds = await close.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
})

test('cartão de carteira mantém nomes longos e opções alcançáveis em 320 px', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  const nickname = 'CarteiraPrincipalComUmNomeMuitoCompridoSemEspacos'
  await page.evaluate(async (name) => {
    const token = localStorage.getItem('kurio.session-token')!
    const wallet = { displayName: 'Colecionador', nickname: name, network: 'ethereum', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'identificadormuitocompridosemespacos' }
    const response = await fetch('/api/v1/wallets/primary', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'If-Match': '0' }, body: JSON.stringify(wallet) })
    if (!response.ok) throw new Error(`Carteira: ${response.status}`)
  }, nickname)
  await page.reload()
  await page.getByLabel(`Carteira principal — ${nickname}`).click()
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Colecionador')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  const card = page.locator('.checkout-wallet-card').filter({ hasText: nickname })
  await expect(card).toBeVisible()
  const geometry = await card.evaluate((element) => {
    const card = element.getBoundingClientRect()
    const text = element.querySelector('label > span')!.getBoundingClientRect()
    const menu = element.querySelector('summary')!.getBoundingClientRect()
    return { cardLeft: card.left, cardRight: card.right, textRight: text.right, menuLeft: menu.left, menuRight: menu.right, width: document.documentElement.scrollWidth }
  })
  expect(geometry.width).toBeLessThanOrEqual(320)
  expect(geometry.textRight).toBeLessThanOrEqual(geometry.menuLeft)
  expect(geometry.menuRight).toBeLessThanOrEqual(geometry.cardRight)
  expect(geometry.cardLeft).toBeGreaterThanOrEqual(0)
  await page.getByLabel(`Opções da carteira ${nickname}`).click()
  await expect(page.getByRole('link', { name: 'Editar', exact: true })).toBeVisible()
  await page.getByLabel(`Opções da carteira ${nickname}`).click()
  await page.getByRole('button', { name: 'Revisar dados' }).click()
  const review = page.getByRole('dialog', { name: 'Revisão dos dados' })
  await expect(review).toContainText(nickname)
  expect(await review.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await review.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  const confirm = page.getByRole('button', { name: 'Confirmar compra', exact: true })
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15000 })
  await page.locator('.order-collector summary').click()
  await expect(page.locator('.order-collector')).toContainText(nickname)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.getByRole('button', { name: 'Ver transação simulada' }).click()
  const transaction = page.getByRole('dialog', { name: 'Transação simulada' })
  await expect(transaction).toBeVisible()
  expect(await transaction.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
})

for (const entry of [
  { name: 'perfil', path: '/profile', selector: 'button:has-text("Salvar")' },
  { name: 'carteiras', path: '/wallets', selector: 'button:has-text("Salvar carteira")' },
  { name: 'favoritos', path: '/favorites', selector: 'a:has-text("Explorar NFTs")' },
  { name: 'pagamento', path: '/checkout', selector: 'button:has-text("Continuar")' },
]) {
  test(`${entry.name} mantém ação alcançável em 320 px`, async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/?mockScenario=visual-mobile')
    await expect(page.locator('a[href="/nfts/emerald-ape-042"]').first()).toBeVisible()
    await page.evaluate(async (path) => {
      const [{ sessionManager }, { router }] = await Promise.all([import('/src/app/session.ts'), import('/src/app/router.tsx')])
      await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
      await router.navigate({ href: path })
    }, entry.path)
    const action = page.locator(entry.selector).first()
    await expect(action).toBeVisible()
    await action.scrollIntoViewIfNeeded()
    const bounds = await action.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })
}
