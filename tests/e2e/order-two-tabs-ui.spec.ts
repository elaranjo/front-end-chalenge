import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`simultaneous checkout tabs create at most one order at ${width}px`, async ({ page, context }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcheckout&mockScenario=pending-disconnect')
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
    const other = await context.newPage()
    await other.setViewportSize({ width, height: 900 })
    await other.goto('http://127.0.0.1:5173/checkout')
    for (const tab of [page, other]) {
      await expect(tab.getByLabel('Nome de exibição')).toBeVisible()
      const walletChoice = tab.getByLabel(/Carteira principal — Principal/)
      if (await walletChoice.isVisible()) await walletChoice.click()
      if (width < 1280) await tab.getByRole('button', { name: 'Continuar', exact: true }).click()
      await tab.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
      await expect(tab.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeEnabled()
    }
    const availability = () => page.evaluate(async () => {
      const response = await fetch('/api/v1/nfts/emerald-ape-042')
      if (!response.ok) throw new Error(`nft ${response.status}`)
      const nft = await response.json()
      return nft.editions.find((edition: { id: string }) => edition.id === 'one-of-fifty').available as number
    })
    const before = await availability()
    const requests: Array<{ key: string | undefined; body: string | null }> = []
    for (const tab of [page, other]) tab.on('request', (request) => {
      if (request.url().endsWith('/api/v1/orders') && request.method() === 'POST') requests.push({ key: request.headers()['idempotency-key'], body: request.postData() })
    })
    const locker = await context.newPage()
    await locker.goto('http://127.0.0.1:5173/')
    await locker.evaluate(() => {
      void navigator.locks.request('kurio.order-attempt', async () => {
        await new Promise<void>((resolve) => { Object.assign(window, { releaseOrderTestLock: resolve, orderTestLockHeld: true }) })
      })
    })
    await expect.poll(() => locker.evaluate(() => Boolean((window as unknown as { orderTestLockHeld?: boolean }).orderTestLockHeld))).toBe(true)
    await Promise.all([page, other].map((tab) => tab.getByRole('button', { name: 'Confirmar compra', exact: true }).click()))
    await locker.evaluate(() => (window as unknown as { releaseOrderTestLock: () => void }).releaseOrderTestLock())
    await expect.poll(() => requests.length).toBeGreaterThan(0)
    await expect.poll(() => page.url().includes('/orders/') || other.url().includes('/orders/')).toBe(true)
    for (const tab of [page, other]) {
      await expect.poll(async () => tab.url().includes('/orders/') || await tab.getByRole('alert').filter({ hasText: 'Recupere a tentativa existente' }).isVisible()).toBe(true)
    }
    const attempt = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.order-attempt')!))
    expect(attempt.key).toBeTruthy()
    expect(new Set(requests.map((request) => request.key))).toEqual(new Set([attempt.key]))
    expect(new Set(requests.map((request) => request.body)).size).toBe(1)
    const order = await page.evaluate(async (key) => {
      const token = localStorage.getItem('kurio.session-token')
      const response = await fetch(`/api/v1/orders/attempts/${key}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error(`lookup ${response.status}`)
      return response.json()
    }, attempt.key)
    expect([page.url(), other.url()].filter((url) => url.includes('/orders/')).every((url) => url.endsWith(`/orders/${order.id}`))).toBe(true)
    expect(await availability()).toBe(before - 1)
    await locker.close()
    await other.close()
  })
}
