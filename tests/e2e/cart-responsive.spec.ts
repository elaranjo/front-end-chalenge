import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`cart quantity, coupons and removal survive refresh at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
    await expect(page.locator('.cart-line')).toHaveCount(4)
    const changed = page.waitForResponse((response) => response.url().includes('/api/v1/cart/items/') && response.request().method() === 'PATCH' && response.ok())
    await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
    await changed
    await expect(page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })).toContainText('2.38 ETH')
    const coupon = page.getByLabel('Código promocional')
    for (const [value, message] of [['INVALIDO', 'Cupom inválido'], ['EXPIRADO', 'Cupom expirado']] as const) {
      await coupon.fill(value)
      await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
      await expect(page.getByRole('alert')).toHaveText(message)
    }
    await coupon.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remover cupom' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remover cupom' })).toBeVisible()
    await expect(page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })).toContainText('2.38 ETH')
    await page.getByRole('button', { name: 'Remover cupom' }).click()
    await expect(page.getByRole('button', { name: 'Remover cupom' })).toHaveCount(0)
    for (const name of ['Emerald Ape #042', 'Violet Nomad #314', 'Ivory Baron #088', 'Golden Beat #207']) {
      const deleted = page.waitForResponse((response) => response.url().includes('/api/v1/cart/items/') && response.request().method() === 'DELETE' && response.ok())
      await page.getByRole('button', { name: `Remover ${name}` }).click()
      await deleted
      await expect(page.locator('.cart-line').filter({ hasText: name })).toHaveCount(0)
    }
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test(`visitor cart merges once across repeated login at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
    await page.getByRole('button', { name: '1/10', exact: true }).click()
    await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).click()
    const add = page.waitForResponse((response) => response.url().endsWith('/api/v1/cart/items') && response.request().method() === 'POST' && response.ok())
    await page.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click()
    await add
    await expect(page.getByRole('status')).toHaveText('NFT adicionado ao carrinho.')
    await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcart')
    await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
    const merged = page.waitForResponse((response) => response.url().endsWith('/api/v1/cart/merge') && response.request().method() === 'POST' && response.ok())
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await merged
    await expect(page).toHaveURL(/\/cart$/)
    const line = page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })
    await expect(line).toHaveCount(1)
    await expect(line.locator('.cart-stepper > span')).toHaveText('2')
    await page.reload()
    await expect(line.locator('.cart-stepper > span')).toHaveText('2')
    await page.goto('http://127.0.0.1:5173/profile')
    if (width < 1280) await page.getByRole('button', { name: 'Meu perfil', exact: true }).click()
    await page.getByRole('button', { name: 'Sair', exact: true }).click()
    await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcart')
    await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(line).toHaveCount(1)
    await expect(line.locator('.cart-stepper > span')).toHaveText('2')
  })

  test(`realtime stock, price, expired coupon and fee reconcile at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
    const checkout = page.getByRole('button', { name: 'Conectar e finalizar' })
    const item = page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })
    await expect(checkout).toBeEnabled()
    await page.getByLabel('Código promocional').fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remover cupom' })).toBeVisible()
    const action = (body: object) => page.evaluate(async (value) => (await fetch('/api/v1/__mock/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
    })).ok, body)
    expect(await action({ action: 'updateFee', payload: { amount: '0.03' } })).toBe(true)
    expect(await action({ action: 'expireCoupon', payload: { code: 'KURIO10' } })).toBe(true)
    expect(await action({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '2.50', available: 0 } })).toBe(true)
    await expect(page.getByRole('status').filter({ hasText: 'O cupom expirou.' })).toBeVisible()
    await expect(item.locator('b')).toHaveText('2.5 ETH')
    await expect(item.getByRole('alert')).toHaveText('Estoque disponível: 0')
    await expect(checkout).toBeDisabled()
    await page.getByRole('button', { name: 'Remover cupom' }).click()
    await expect(page.locator('.cart-totals').getByText('0.03 ETH')).toBeVisible()
    await expect(checkout).toBeDisabled()
    await item.getByRole('button', { name: 'Remover Emerald Ape #042' }).click()
    await expect(item).toHaveCount(0)
    await expect(checkout).toBeEnabled()
  })
}
