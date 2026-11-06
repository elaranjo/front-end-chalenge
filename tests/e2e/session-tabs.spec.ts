import { expect, test } from '@playwright/test'

test('logout reports an unconfirmed remote revocation after clearing local state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('http://127.0.0.1:5173/?mockScenario=validation-errors')
  await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const [{ sessionManager }, { router }] = await Promise.all([import('/src/app/session.ts'), import('/src/app/router.tsx')])
    await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
    await router.navigate({ href: '/profile' })
  })
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  const failure = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/logout') && response.status() === 422)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await failure
  await expect(page).toHaveURL('http://127.0.0.1:5173/')
  await expect(page.getByRole('alert')).toContainText('A sessão local foi encerrada, mas não foi possível confirmar')
  expect(await page.evaluate(() => localStorage.getItem('kurio.session-token'))).toBeNull()
  expect(pageErrors).toEqual([])
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a delayed logout failure cannot redirect or warn a newly authenticated account', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fprofile')
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await page.evaluate(async () => {
    const { api } = await import('/src/shared/http.ts')
    api.interceptors.request.use(async (config) => {
      if (config.url === '/auth/logout') {
        await new Promise<void>((resolve) => { (window as Window & { releaseLogout?: () => void }).releaseLogout = resolve })
        throw new Error('Falha de logout atrasada')
      }
      return config
    })
  })
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Boolean((window as Window & { releaseLogout?: () => void }).releaseLogout))).toBe(true)
  await expect(page).toHaveURL(/\/login\?returnTo=/)
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.b@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoB!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await page.evaluate(async () => {
    (window as Window & { releaseLogout: () => void }).releaseLogout()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  await expect.poll(() => page.evaluate(async () => (await import('/src/app/session.ts')).sessionManager.session?.userId)).toBe('collector-b')
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('alert').filter({ hasText: 'não foi possível confirmar o encerramento' })).toHaveCount(0)
})

test('another tab changes session without leaking private client state', async ({ context, page }) => {
  const other = await context.newPage()
  await Promise.all([page.goto('http://127.0.0.1:5173/'), other.goto('http://127.0.0.1:5173/')])
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect.poll(() => other.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
  })
  await other.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    await sessionManager.login('colecionador.b@kurio.test', 'DemoB!2026')
  })
  await expect.poll(() => page.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    return sessionManager.session?.userId ?? null
  })).toBeNull()
  const state = await other.evaluate(async () => {
    const { sessionManager } = await import('/src/app/session.ts')
    return { userId: sessionManager.session?.userId, stored: localStorage.getItem('kurio.session-token') === sessionManager.session?.token }
  })
  expect(state).toEqual({ userId: 'collector-b', stored: true })
})

test('simultaneous expired requests clear the session once and retain the checkout attempt', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const reset = await fetch('/api/v1/__mock/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'default', clockMode: 'manual' }) })
    if (!reset.ok) throw new Error(`Reset failed: ${reset.status}`)
    const [{ sessionManager }, { api }, { queryClient }] = await Promise.all([import('/src/app/session.ts'), import('/src/shared/http.ts'), import('/src/app/query-client.ts')])
    await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
    const generation = sessionManager.sessionGeneration
    const saved = JSON.stringify({ ownerUserId: 'collector-a', key: 'preserved' })
    localStorage.setItem('kurio.order-attempt', saved)
    const privateQuery = queryClient.getQueryCache().build(queryClient, { queryKey: ['test-private'], meta: { private: true } })
    privateQuery.setData({ value: 'private' })
    const advanced = await fetch('/api/v1/__mock/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advanceMs: 30 * 60_000 }) })
    if (!advanced.ok) throw new Error(`Clock failed: ${advanced.status}`)
    const responses = await Promise.allSettled(['/profile', '/wallets', '/favorites'].map((path) => api.get(path)))
    const after = { generation: sessionManager.sessionGeneration, session: sessionManager.session, cached: queryClient.getQueryData(['test-private']), saved: localStorage.getItem('kurio.order-attempt'), failed: responses.filter((response) => response.status === 'rejected').length }
    await sessionManager.login('colecionador.a@kurio.test', 'DemoA!2026')
    return { beforeGeneration: generation, after, restoredOwner: sessionManager.session?.userId, attemptAfterLogin: localStorage.getItem('kurio.order-attempt'), saved }
  })
  expect(result.after.generation).toBe(result.beforeGeneration + 1)
  expect(result.after.session).toBeNull()
  expect(result.after.cached).toBeUndefined()
  expect(result.after.saved).toBe(result.saved)
  expect(result.after.failed).toBe(3)
  expect(result.restoredOwner).toBe('collector-a')
  expect(result.attemptAfterLogin).toBe(result.saved)
})

test('private routes require login and a restored session survives a direct refresh', async ({ page }) => {
  for (const path of ['/checkout', '/profile', '/wallets', '/favorites', '/orders/example']) {
    await page.goto(`http://127.0.0.1:5173${path}`)
    await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=${encodeURIComponent(path)}`))
  }
  await page.goto('http://127.0.0.1:5173/profile')
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await expect(page.locator('#profile-email')).toHaveValue('colecionador.a@kurio.test')
})

test('logout keeps the private cart with its owner and starts an empty visitor cart', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fnfts%2Femerald-ape-042')
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('status')).toHaveText('NFT adicionado ao carrinho.')
  await page.goto('http://127.0.0.1:5173/profile')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await page.goto('http://127.0.0.1:5173/cart')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcart')
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.b@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoB!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  await page.goto('http://127.0.0.1:5173/profile')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcart')
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.locator('.cart-line').getByText('Emerald Ape #042')).toBeVisible()
})
