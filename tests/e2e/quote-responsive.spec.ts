import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`price and fee updates require a fresh checkout review at ${width}px`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.addInitScript(() => {
      const events: string[] = []
      ;(window as unknown as { observedSocketFrames: string[] }).observedSocketFrames = events
      const original = EventTarget.prototype.dispatchEvent
      EventTarget.prototype.dispatchEvent = function (event: Event) {
        if (event instanceof MessageEvent && typeof event.data === 'string' && event.data.includes('nft.updated') && 'url' in this && typeof this.url === 'string' && this.url.includes('/socket.io/')) events.push(event.data)
        return original.call(this, event)
      }
    })
    const orderRequests: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/v1/orders' && request.method() === 'POST') orderRequests.push(request.url())
    })
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
      const added = await fetch('/api/v1/cart/items', { method: 'POST', headers: { ...auth, 'If-Match': '0', 'X-Mutation-Id': crypto.randomUUID() }, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: 'one-of-fifty', quantity: 1 }) })
      if (!added.ok) throw new Error(`cart ${added.status}`)
    })
    await page.reload()
    await page.getByLabel(/Carteira principal — Principal/).click()
    if (width < 1280) await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    const setRefusal = (refuse: boolean) => page.evaluate(async (value) => (await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setWalletConnectionBehavior', payload: { refuse: value } }) })).ok, refuse)
    expect(await setRefusal(true)).toBe(true)
    const refused = page.waitForResponse((response) => response.url().endsWith('/api/v1/wallet-connections') && response.request().method() === 'POST' && response.ok())
    await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
    expect((await (await refused).json()).status).toBe('refused')
    await expect(page.getByRole('alert')).toHaveText('A conexão da carteira foi recusada.')
    await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeDisabled()
    expect(await setRefusal(false)).toBe(true)
    await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
    const confirm = page.getByRole('button', { name: 'Confirmar compra', exact: true })
    await expect(confirm).toBeEnabled()
    const disconnected = page.waitForResponse((response) => response.url().includes('/api/v1/wallet-connections/') && response.request().method() === 'DELETE' && response.ok())
    await page.getByRole('button', { name: 'Desconectar carteira', exact: true }).click()
    await disconnected
    await expect(confirm).toBeDisabled()
    await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
    await expect(confirm).toBeEnabled()
    const updatePrice = await page.evaluate(async () => (await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '2.50' } }) })).ok)
    expect(updatePrice).toBe(true)
    await expect.poll(() => page.evaluate(() => (window as unknown as { observedSocketFrames: string[] }).observedSocketFrames.some((frame) => frame.includes('emerald-ape-042')))).toBe(true)
    const refresh = page.getByRole('button', { name: 'Atualizar cotação' })
    await expect(refresh).toBeEnabled()
    await expect(confirm).toBeDisabled()
    await refresh.click()
    const review = page.getByRole('dialog', { name: 'Revisão dos dados' })
    await expect(review).toContainText('Anterior: 1 × 1.19 ETH')
    await expect(review).toContainText('2.50 ETH')
    expect(await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))).toBeNull()
    await review.getByRole('button', { name: 'Fechar' }).click()
    const updateFee = await page.evaluate(async () => (await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateFee', payload: { amount: '0.031' } }) })).ok)
    expect(updateFee).toBe(true)
    await confirm.click()
    await expect(review).toContainText('Anterior: 0.016 ETH')
    await expect(review).toContainText('0.031 ETH')
    expect(await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))).toBeNull()
    await review.getByRole('button', { name: 'Fechar' }).click()
    await expect(confirm).toBeEnabled()
    expect(orderRequests).toHaveLength(0)
    const orderResponse = page.waitForResponse((response) => response.url().endsWith('/api/v1/orders') && response.request().method() === 'POST')
    await confirm.click()
    expect((await orderResponse).ok()).toBe(true)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15000 })
    expect(orderRequests).toHaveLength(1)
    await expect(page.locator('.order-item')).toContainText('2.50 ETH')
    await expect(page.locator('.order-receipt')).toContainText('0.031 ETH')
  })
}
