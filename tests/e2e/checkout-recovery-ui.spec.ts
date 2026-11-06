import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
test(`a lost order response remains one attempt and is recovered on refresh at ${width}px`, async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width, height: 900 })
  await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcheckout&mockScenario=timeout-after-order-create')
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
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  const confirm = page.getByRole('button', { name: 'Confirmar compra' })
  await expect(confirm).toBeEnabled()
  let posts = 0
  page.on('request', (request) => { if (request.url().endsWith('/api/v1/orders') && request.method() === 'POST') posts++ })
  await confirm.evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(page.getByRole('alert')).toContainText('A resposta da compra não foi recebida', { timeout: 20000 })
  const saved = await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))
  expect(saved).not.toBeNull()
  expect(posts).toBe(1)
  const expired = await page.evaluate(async () => {
    const token = localStorage.getItem('kurio.session-token')!
    const session = await (await fetch('/api/v1/auth/session', { headers: { Authorization: `Bearer ${token}` } })).json()
    return (await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'expireSession', payload: { sessionId: session.sessionId } }) })).ok
  })
  expect(expired).toBe(true)
  await page.reload()
  await expect(page).toHaveURL(/\/login\?returnTo=/)
  expect(await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))).toBe(saved)
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/orders\//, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15000 })
  expect(await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))).toBe(saved)
  const recovered = await page.evaluate(async () => {
    const attempt = JSON.parse(localStorage.getItem('kurio.order-attempt')!)
    const token = localStorage.getItem('kurio.session-token')
    const response = await fetch(`/api/v1/orders/attempts/${attempt.key}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error(`lookup ${response.status}`)
    return (await response.json()).id
  })
  expect(page.url()).toContain(`/orders/${recovered}`)
  expect(posts).toBe(1)
})

test(`a declined order preserves the cart and permits an explicit new attempt at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcheckout&mockScenario=payment-declined')
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
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\//)
  await expect(page.getByRole('heading', { name: 'Compra recusada' })).toBeVisible({ timeout: 15000 })
  const firstAttempt = await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))
  expect(firstAttempt).not.toBeNull()
  await page.getByRole('button', { name: 'Voltar ao carrinho' }).click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByText('Emerald Ape #042')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))).toBeNull()
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  if (width < 1280) await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\//)
  const secondAttempt = await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))
  expect(JSON.parse(secondAttempt!).key).not.toBe(JSON.parse(firstAttempt!).key)
})

}

test('an uncommitted attempt rejected as stale returns to a recoverable checkout', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcheckout')
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await page.evaluate(async () => {
    const token = localStorage.getItem('kurio.session-token')!
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const request = async (url: string, method: string, body: unknown, headers: Record<string, string> = {}) => {
      const response = await fetch(`/api/v1${url}`, { method, headers: { ...auth, ...headers }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(`${url} ${response.status}`)
      return response.json()
    }
    const wallet = { displayName: 'Colecionador', nickname: 'Principal', network: 'ethereum', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'colecionador' }
    const saved = await request('/wallets/primary', 'PUT', wallet, { 'If-Match': '0' })
    const cart = await request('/cart/items', 'POST', { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', quantity: 1 }, { 'If-Match': '0', 'X-Mutation-Id': crypto.randomUUID() })
    const connection = await request('/wallet-connections', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum' })
    const quote = await request('/quotes', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.revision })
    const collector = { displayName: wallet.displayName, username: 'principal', network: wallet.network, profileName: wallet.profileName, address: wallet.address, walletType: wallet.type, referralCode: wallet.referralCode, email: wallet.email, ensName: wallet.ensName }
    localStorage.setItem('kurio.order-attempt', JSON.stringify({ ownerUserId: 'collector-a', key: crypto.randomUUID(), payload: { quoteId: quote.id, quoteFingerprint: quote.fingerprint, cartRevision: cart.revision, walletId: saved.id, provider: 'metamask', network: 'ethereum', connectionId: connection.id, collector } }))
    const fee = await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateFee', payload: { amount: '0.04' } }) })
    if (!fee.ok) throw new Error(`fee ${fee.status}`)
  })
  await page.reload()
  await page.getByRole('button', { name: 'Reenviar a mesma tentativa' }).click()
  await expect(page.getByRole('alert')).toContainText('A tentativa foi recusada antes da criação do pedido')
  expect(await page.evaluate(() => localStorage.getItem('kurio.order-attempt'))).toBeNull()
  await expect(page.getByLabel(/Carteira principal — Principal/)).toBeVisible()
})

for (const width of [390, 1440]) {
test(`the visible pending order reconciles after a missed confirmation without another purchase at ${width}px`, async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(() => {
    const sockets = new Set<EventTarget>()
    ;(window as unknown as { observedOpenSockets: () => number }).observedOpenSockets = () => sockets.size
    const original = EventTarget.prototype.dispatchEvent
    EventTarget.prototype.dispatchEvent = function (event: Event) {
      if ('url' in this && typeof this.url === 'string' && this.url.includes('/socket.io/')) {
        if (event.type === 'open') sockets.add(this)
        if (event.type === 'close') sockets.delete(this)
      }
      return original.call(this, event)
    }
  })
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
    const added = await fetch('/api/v1/cart/items', { method: 'POST', headers: { ...auth, 'If-Match': '0', 'X-Mutation-Id': crypto.randomUUID() }, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: 'one-of-fifty', quantity: 1 }) })
    if (!added.ok) throw new Error(`cart ${added.status}`)
  })
  await page.reload()
  await page.getByLabel(/Carteira principal — Principal/).click()
  if (width < 1280) await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  let purchases = 0
  page.on('request', (request) => { if (request.url().endsWith('/api/v1/orders') && request.method() === 'POST') purchases++ })
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()
  const orderUrl = page.url()
  await expect.poll(() => page.evaluate(() => (window as unknown as { observedOpenSockets: () => number }).observedOpenSockets())).toBe(1)
  expect(await page.evaluate(async () => (await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) })).ok)).toBe(true)
  await expect.poll(() => page.evaluate(async () => (await import('/src/app/realtime.ts')).realtime.isReady)).toBe(false)
  await expect.poll(() => page.evaluate(() => (window as unknown as { observedOpenSockets: () => number }).observedOpenSockets())).toBe(0)
  expect(await page.evaluate(async () => (await fetch('/api/v1/__mock/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advanceMs: 2000 }) })).ok)).toBe(true)
  const orderId = new URL(orderUrl).pathname.split('/').at(-1)!
  await expect.poll(() => page.evaluate(async (id) => {
    const { realtime } = await import('/src/app/realtime.ts')
    const observedOpenSockets = (window as unknown as { observedOpenSockets: () => number }).observedOpenSockets
    if (realtime.isReady || observedOpenSockets() !== 0) return 'reconnected'
    const response = await fetch(`/api/v1/orders/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('kurio.session-token')}` } })
    const order = await response.json()
    return realtime.isReady || observedOpenSockets() !== 0 ? 'reconnected' : order.status
  }, orderId), { timeout: 10000 }).toBe('confirmed')
  await expect.poll(() => page.evaluate(() => (window as unknown as { observedOpenSockets: () => number }).observedOpenSockets()), { timeout: 15000 }).toBe(1)
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15000 })
  expect(page.url()).toBe(orderUrl)
  expect(purchases).toBe(1)
})
}
