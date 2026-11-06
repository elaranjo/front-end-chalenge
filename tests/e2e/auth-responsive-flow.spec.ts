import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`expired session during navigation returns to the requested page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fprofile')
    await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()

    const expired = await page.evaluate(async () => {
      const token = localStorage.getItem('kurio.session-token')!
      const session = await (await fetch('/api/v1/auth/session', { headers: { Authorization: `Bearer ${token}` } })).json()
      const response = await fetch('/api/v1/__mock/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'expireSession', payload: { sessionId: session.sessionId } }),
      })
      const check = await fetch('/api/v1/auth/session', { headers: { Authorization: `Bearer ${token}` } })
      return { expired: response.ok, status: check.status }
    })
    expect(expired).toEqual({ expired: true, status: 401 })
    await page.goto('http://127.0.0.1:5173/wallets')
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fwallets/)
    await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/wallets$/)
    await expect(page.getByText('Carteira principal', { exact: true }).first()).toBeVisible()
  })

  test(`signup conflict, session recovery and login are observed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('http://127.0.0.1:5173/signup?returnTo=%2Fprofile')
    const username = page.getByLabel('Nome de usuário')
    const email = page.getByLabel('E-mail', { exact: true })
    const password = page.getByLabel('Senha', { exact: true })
    await username.fill('colecionador.a')
    await email.fill('colecionador.a@kurio.test')
    await password.fill('DemoNova!2026')
    await page.getByLabel('Confirmar senha').fill('DemoNova!2026')
    const conflict = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/signup') && response.status() === 409)
    await page.getByRole('button', { name: width < 1280 ? 'Criar perfil' : 'Criar conta' }).click()
    await conflict
    await expect(page.getByRole('alert')).toContainText('E-mail ou nome de usuário já cadastrado')
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAttribute('aria-invalid', 'true')

    await username.fill('colecionador-novo')
    await email.fill('novo@kurio.test')
    const signup = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/signup') && response.status() === 201)
    await page.getByRole('button', { name: width < 1280 ? 'Criar perfil' : 'Criar conta' }).click()
    await signup
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('colecionador-novo')
    await page.reload()
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('colecionador-novo')
    if (width < 1280) await page.getByRole('button', { name: 'Meu perfil', exact: true }).click()
    const logout = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/logout') && response.ok())
    await page.getByRole('button', { name: 'Sair', exact: true }).click()
    await logout

    await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fprofile')
    await page.getByLabel('E-mail', { exact: true }).fill('novo@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada')
    const rejected = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login') && response.status() === 401)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await rejected
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha inválidos' })).toBeVisible()
    if (width >= 1280) await expect(page.locator('.home-grid .home-card').first()).toBeAttached()
    await page.getByLabel('Senha', { exact: true }).fill('DemoNova!2026')
    const login = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login') && response.ok())
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await login
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('colecionador-novo')
  })
}
