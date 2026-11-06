import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 414, height: 896 } })

test('cart updates quantities, applies a coupon and persists removals', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
  await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()
  await expect(page.locator('.cart-lines').getByText('Emerald Ape #042')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
  const geometry = await page.evaluate(() => ({
    items: [...document.querySelectorAll('.cart-line')].map((element) => { const rect = element.getBoundingClientRect(); return { y: Math.round(rect.y), height: Math.round(rect.height) } }),
    summaryY: Math.round(document.querySelector('.cart-summary')!.getBoundingClientRect().y),
  }))
  expect(geometry).toEqual({ items: [{ y: 88, height: 100 }, { y: 208, height: 100 }, { y: 328, height: 102 }, { y: 450, height: 100 }], summaryY: 554 })
  const controls = await page.locator('.cart-line').evaluateAll((lines) => lines.map((line) => {
    const card = line.getBoundingClientRect()
    const remove = line.querySelector('.cart-remove')!.getBoundingClientRect()
    const stepper = line.querySelector('.cart-stepper')!.getBoundingClientRect()
    return { top: remove.top - card.top, right: card.right - remove.right, separated: remove.bottom <= stepper.top }
  }))
  expect(controls).toEqual(Array.from({ length: 4 }, () => ({ top: 4, right: 12, separated: true })))
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
  await expect(page.locator('.cart-totals')).toHaveCSS('font-size', '15px')
  expect(await page.getByRole('button', { name: 'Conectar e finalizar' }).boundingBox()).toMatchObject({ x: 24, y: 800, width: 366, height: 60 })
  await page.screenshot({ path: 'tmp/cart-mobile.png' })
  await page.screenshot({ path: 'tmp/cart-mobile-full.png', fullPage: true })
  await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
  await expect(page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' }).locator('b')).toHaveText('2.38 ETH')
  await page.getByLabel('Código promocional').fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('KURIO10', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Remover Emerald Ape #042' }).click()
  await expect(page.locator('.cart-lines').getByText('Emerald Ape #042')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.cart-lines').getByText('Emerald Ape #042')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Remover cupom' })).toBeVisible()
})

test('coupon errors are associated with the input and totals follow the API', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
  const input = page.getByLabel('Código promocional')
  const totals = page.locator('.cart-totals')
  await expect(totals.getByText('8.156 ETH')).toBeVisible()
  await input.fill('INVALIDO')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Cupom inválido')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await input.fill('EXPIRADO')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Cupom expirado')
  await input.fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remover cupom' })).toBeVisible()
  await expect(totals.getByText('7.342 ETH')).toBeVisible()
  await expect(totals.getByText('(−) 0.814')).toBeVisible()
  await page.getByRole('button', { name: 'Remover cupom' }).click()
  await expect(totals.getByText('8.156 ETH')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remover cupom' })).toHaveCount(0)
})

test('realtime price and stock updates preserve the item and block checkout when sold out', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
  const item = page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })
  await expect(item).toBeVisible()
  const updated = await page.evaluate(async () => (await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '2.50', available: 0 } }) })).ok)
  expect(updated).toBe(true)
  await expect(page.getByRole('status').filter({ hasText: 'Preço ou disponibilidade atualizado' })).toBeVisible()
  await expect(item.locator('b')).toHaveText('2.5 ETH')
  await expect(item.getByRole('alert')).toHaveText('Estoque disponível: 0')
  await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
  await expect(item.getByRole('button', { name: 'Remover Emerald Ape #042' })).toBeEnabled()
  await item.getByRole('button', { name: 'Remover Emerald Ape #042' }).click()
  await expect(item).toHaveCount(0)
})

test('checkout stays blocked while an existing cart is refreshed after a price change', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/?mockScenario=slow')
  await expect(page.locator('a[href="/nfts/emerald-ape-042"]').first()).toBeVisible({ timeout: 15000 })
  const seeded = await page.evaluate(async () => {
    const visitor = localStorage.getItem('kurio.visitor-id')!
    return (await fetch('/api/v1/cart/items', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': visitor, 'If-Match': '0', 'X-Mutation-Id': crypto.randomUUID() }, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: 'one-of-fifty', quantity: 1 }) })).ok
  })
  expect(seeded).toBe(true)
  await page.goto('http://127.0.0.1:5173/cart')
  const checkout = page.getByRole('button', { name: 'Conectar e finalizar' })
  await expect(checkout).toBeEnabled({ timeout: 15000 })
  const updated = await page.evaluate(async () => (await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '2.50' } }) })).ok)
  expect(updated).toBe(true)
  await expect(page.getByRole('status').filter({ hasText: 'Atualizando o carrinho' })).toBeVisible()
  await expect(checkout).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'Preço ou disponibilidade atualizado' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' }).locator('b')).toHaveText('2.5 ETH')
  await expect(checkout).toBeEnabled()
})

test('a failed background cart refresh preserves the displayed cart and recovers on retry', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
  const checkout = page.getByRole('button', { name: 'Conectar e finalizar' })
  const item = page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })
  await expect(checkout).toBeEnabled()
  const action = (body: object) => page.evaluate(async (value) => (await fetch('/api/v1/__mock/actions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
  })).ok, body)
  expect(await action({ action: 'setCartReadFailure', payload: { enabled: true } })).toBe(true)
  expect(await action({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '2.50' } })).toBe(true)
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível atualizar o carrinho' })).toBeVisible({ timeout: 15000 })
  await expect(item.locator('b')).toHaveText('1.19 ETH')
  await expect(checkout).toBeDisabled()
  expect(await action({ action: 'setCartReadFailure', payload: { enabled: false } })).toBe(true)
  await page.getByRole('alert').filter({ hasText: 'Não foi possível atualizar o carrinho' }).getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(item.locator('b')).toHaveText('2.5 ETH', { timeout: 15000 })
  await expect(checkout).toBeEnabled()
})

test('reconciliation blocks an expired coupon and loads the updated network fee', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
  const checkout = page.getByRole('button', { name: 'Conectar e finalizar' })
  await expect(checkout).toBeEnabled()
  await page.getByLabel('Código promocional').fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remover cupom' })).toBeVisible()
  const action = (body: object) => page.evaluate(async (value) => (await fetch('/api/v1/__mock/actions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
  })).ok, body)
  expect(await action({ action: 'updateFee', payload: { amount: '0.03' } })).toBe(true)
  expect(await action({ action: 'expireCoupon', payload: { code: 'KURIO10' } })).toBe(true)
  expect(await action({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '2.50' } })).toBe(true)
  await expect(page.getByRole('status').filter({ hasText: 'O cupom expirou.' })).toBeVisible()
  await expect(checkout).toBeDisabled()
  await page.getByRole('button', { name: 'Remover cupom' }).click()
  await expect(page.locator('.cart-totals').getByText('0.03 ETH')).toBeVisible()
  await expect(page.locator('.cart-totals').getByText('9.48 ETH')).toBeVisible()
  await expect(checkout).toBeEnabled()
})
