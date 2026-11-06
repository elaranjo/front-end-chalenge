import { expect, test } from '@playwright/test'

test('mobile reference state uses the visual cart and the selected Polygon reserve wallet', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 })
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
  await expect(page.locator('.cart-line')).toHaveCount(4)
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await page.evaluate(async () => {
    const token = localStorage.getItem('kurio.session-token')!
    const common = { displayName: 'Colecionador', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'nova-kurio' }
    for (const [slot, nickname, network] of [['primary', 'Principal', 'ethereum'], ['secondary', 'Reserva', 'polygon']]) {
      const response = await fetch(`/api/v1/wallets/${slot}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'If-Match': '0' }, body: JSON.stringify({ ...common, nickname, network }) })
      if (!response.ok) throw new Error(`Falha ao preparar ${slot}: ${response.status}`)
    }
  })
  await page.reload()
  await page.getByLabel(/Carteira secundária — Reserva/).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Carteira conectada' })).toBeVisible()
  const cards = page.locator('.checkout-wallet-card')
  await expect(cards.nth(0)).toContainText('Reserva')
  await expect(cards.nth(0)).toContainText('Rede Polygon')
  await expect(cards.nth(1)).toContainText('Principal')
  await expect(cards.nth(1)).toContainText('Rede principal Ethereum')
  for (const [locator, expectedY, height] of [[cards.nth(0), 124, 93], [cards.nth(1), 237, 93], [page.locator('.checkout-providers label').first(), 378, 65]] as const) {
    const bounds = await locator.boundingBox()
    expect(bounds).toMatchObject({ x: 28, width: 358, height })
    expect(bounds!.y).toBeCloseTo(expectedY, 0)
  }
  await expect(page.locator('.checkout-wallet-card').filter({ hasText: 'Reserva' }).locator('input')).toBeChecked()
  await page.getByLabel('Coinbase Wallet').check()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
  await expect(page.locator('.checkout-totals')).toContainText('8.156 ETH')
  await page.getByRole('heading', { name: 'Pagamento com carteira' }).click()
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
  await page.screenshot({ path: 'tmp/checkout-mobile-reference.png' })
  await page.screenshot({ path: 'tmp/checkout-mobile-reference-full.png', fullPage: true })
})
