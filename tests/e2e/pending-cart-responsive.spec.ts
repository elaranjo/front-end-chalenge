import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  for (const change of ['addition', 'recreated'] as const) {
  test(`confirmation preserves ${change} during a pending order at ${width}px`, async ({ page, context }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://127.0.0.1:5173/')
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    const reset = await page.evaluate(async () => (await fetch('/api/v1/__mock/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'pending-disconnect', clockMode: 'manual' }) })).ok)
    expect(reset).toBe(true)
    await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcheckout')
    await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await page.evaluate(async () => {
      const token = localStorage.getItem('kurio.session-token')!
      const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const wallet = { displayName: 'Colecionador', nickname: 'Principal', network: 'ethereum', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'colecionador' }
      const saved = await fetch('/api/v1/wallets/primary', { method: 'PUT', headers: { ...auth, 'If-Match': '0' }, body: JSON.stringify(wallet) })
      if (!saved.ok) throw new Error(`wallet ${saved.status}`)
      const added = await fetch('/api/v1/cart/items', { method: 'POST', headers: { ...auth, 'If-Match': '0', 'X-Mutation-Id': crypto.randomUUID() }, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: 'one-of-fifty', quantity: 2 }) })
      if (!added.ok) throw new Error(`cart ${added.status}`)
    })
    await page.reload()
    await page.getByLabel(/Carteira principal — Principal/).click()
    if (width < 1280) await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()
    const cart = await context.newPage()
    await cart.setViewportSize({ width, height: 900 })
    await cart.goto('http://127.0.0.1:5173/cart')
    const line = cart.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })
    await expect(line.locator('.cart-stepper > span')).toHaveText('2')
    if (change === 'addition') {
      const changed = cart.waitForResponse((response) => response.url().includes('/api/v1/cart/items/') && response.request().method() === 'PATCH' && response.ok())
      await cart.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
      await changed
      await expect(line.locator('.cart-stepper > span')).toHaveText('3')
    } else {
      const deleted = cart.waitForResponse((response) => response.url().includes('/api/v1/cart/items/') && response.request().method() === 'DELETE' && response.ok())
      await cart.getByRole('button', { name: 'Remover Emerald Ape #042' }).click()
      const removedId = decodeURIComponent(new URL((await deleted).url()).pathname.split('/').at(-1)!)
      await expect(cart.getByText('Seu carrinho está vazio.')).toBeVisible()
      await cart.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
      const added = cart.waitForResponse((response) => response.url().endsWith('/api/v1/cart/items') && response.request().method() === 'POST' && response.ok())
      await cart.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click()
      const addedCart = await (await added).json() as { lines: Array<{ lineId: string; nftId: string; editionId: string }> }
      const recreated = addedCart.lines.find((item) => item.nftId === 'emerald-ape-042' && item.editionId === 'one-of-fifty')
      expect(recreated?.lineId).toBeTruthy()
      expect(recreated!.lineId).not.toBe(removedId)
      await cart.goto('http://127.0.0.1:5173/cart')
      await expect(line.locator('.cart-stepper > span')).toHaveText('1')
    }
    const advanced = await page.evaluate(async () => (await fetch('/api/v1/__mock/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advanceMs: 2000 }) })).ok)
    expect(advanced).toBe(true)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.order-item')).toContainText('2.38 ETH')
    await cart.reload()
    await expect(line.locator('.cart-stepper > span')).toHaveText('1')
    await expect(line).toContainText('1.19 ETH')
  })
  }
}
