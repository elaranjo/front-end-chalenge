import { expect, test } from '@playwright/test'

test('simultaneous tabs use the same persisted order attempt', async ({ context, page }) => {
  const other = await context.newPage()
  const locker = await context.newPage()
  await Promise.all([page.goto('http://127.0.0.1:5173/'), other.goto('http://127.0.0.1:5173/'), locker.goto('http://127.0.0.1:5173/')])
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const setup = await page.evaluate(async () => {
    const json = async (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
      const response = await fetch(`/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (!response.ok) throw new Error(`${path}: ${response.status}`)
      return response.json()
    }
    await json('/__mock/reset', 'POST', { scenario: 'default', clockMode: 'manual' })
    const session = await json('/auth/login', 'POST', { email: 'colecionador.a@kurio.test', password: 'DemoA!2026' })
    const auth = { Authorization: `Bearer ${session.token}` }
    const wallet = { displayName: 'A', nickname: 'Principal', network: 'ethereum', profileName: 'A', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    const saved = await json('/wallets/primary', 'PUT', wallet, { ...auth, 'If-Match': '0' })
    const connection = await json('/wallet-connections', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum' }, auth)
    const cart = await json('/cart/items', 'POST', { nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }, { ...auth, 'If-Match': '0', 'X-Mutation-Id': 'two-tabs-add' })
    const quote = await json('/quotes', 'POST', { walletId: saved.id, provider: 'metamask', network: 'ethereum', cartRevision: cart.revision }, auth)
    const collector = { displayName: 'A', username: 'a', network: 'ethereum', profileName: 'A', address: wallet.address, walletType: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'demo' }
    return { session, payload: { quoteId: quote.id, quoteFingerprint: quote.fingerprint, cartRevision: cart.revision, walletId: saved.id, provider: 'metamask', network: 'ethereum', connectionId: connection.id, collector } }
  })
  await locker.evaluate(() => {
    void navigator.locks.request('kurio.order-attempt', async () => {
      await new Promise<void>((resolve) => { Object.assign(window, { releaseTestLock: resolve, testLockAcquired: true }) })
    })
  })
  await expect.poll(() => locker.evaluate(() => Boolean((window as unknown as { testLockAcquired?: boolean }).testLockAcquired))).toBe(true)
  const submit = (tab: typeof page) => tab.evaluate(async ({ session, payload }) => {
    const [{ OrderAttemptManager }, { default: axios }] = await Promise.all([import('/src/shared/order-attempt.ts'), import('/node_modules/axios/index.js')])
    const client = axios.create({ baseURL: '/api/v1' })
    const sessions = { session, sessionGeneration: 1 }
    return (await new OrderAttemptManager(client, sessions as never, localStorage).create(payload)).id
  }, setup)
  const first = submit(page)
  const second = submit(other)
  await page.waitForTimeout(100)
  await locker.evaluate(() => (window as unknown as { releaseTestLock: () => void }).releaseTestLock())
  const [one, two] = await Promise.all([first, second])
  expect(one).toBe(two)
  const nft = await page.evaluate(async () => (await fetch('/api/v1/nfts/emerald-ape-042')).json())
  expect(nft.editions.find((edition: { id: string }) => edition.id === 'one-of-ten').available).toBe(8)
})
