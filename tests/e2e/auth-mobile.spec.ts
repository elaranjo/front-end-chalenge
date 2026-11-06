import { expect, test } from '@playwright/test'

test('unavailable sign-in and recovery options report their limitation', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 })
  await page.goto('http://127.0.0.1:5173/login')
  for (const label of ['Esqueceu a senha?', 'Continuar com Google', 'Continuar com Facebook']) {
    await page.getByRole('button', { name: label }).click()
    await expect(page.getByRole('alert')).toHaveText('Esta opção não está disponível nesta demonstração.')
    await expect(page).toHaveURL(/\/login$/)
  }
})

test.use({ viewport: { width: 414, height: 896 } })

test('mobile login authenticates and preserves a safe return path', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/login?returnTo=%2F')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  const passwordIcon = page.getByRole('button', { name: 'Mostrar senha', exact: true }).locator('.auth-password-icon')
  expect(await passwordIcon.boundingBox()).toMatchObject({ width: 18, height: 18 })
  await expect(passwordIcon.locator('img')).toHaveAttribute('src', '/assets/icons/auth-mobile-signup-hide-figma.svg')
  const google = page.getByRole('button', { name: 'Continuar com Google' })
  await expect(google.locator('.auth-google-desktop img')).toHaveCount(7)
  await expect(google).toHaveCSS('border-radius', '5px')
  await expect(page.getByRole('button', { name: 'Continuar com Facebook' }).locator('img')).toHaveAttribute('src', '/assets/icons/context-0445e8ea7de3d164.svg')
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
  await page.screenshot({ path: 'tmp/auth-login-mobile.png' })
  await page.screenshot({ path: 'tmp/auth-login-mobile-full.png', fullPage: true })
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('http://127.0.0.1:5173/')
  expect(await page.evaluate(() => Object.values(localStorage).some((value) => value.includes('DemoA!2026')))).toBe(false)
})

test('mobile signup checks confirmation and keeps non-sensitive fields', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/signup')
  await expect(page.getByRole('heading', { name: 'Criar perfil de colecionador' })).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
  await page.screenshot({ path: 'tmp/auth-signup-mobile.png' })
  await page.screenshot({ path: 'tmp/auth-signup-mobile-full.png', fullPage: true })
  await page.getByLabel('Nome de usuário').fill('colecionador-novo')
  await page.getByLabel('E-mail', { exact: true }).fill('novo@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('senha')
  await page.getByLabel('Confirmar senha').fill('outra')
  await page.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(page.getByRole('alert')).toHaveText('As senhas não coincidem.')
  await expect(page.getByLabel('Nome de usuário')).toHaveValue('colecionador-novo')
})

test('signup associates account conflicts with the affected fields', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/signup')
  const username = page.getByLabel('Nome de usuário')
  const email = page.getByLabel('E-mail', { exact: true })
  await username.fill('colecionador.a')
  await email.fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('senha')
  await page.getByLabel('Confirmar senha').fill('senha')
  await page.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(page.getByRole('alert')).toHaveText('E-mail ou nome de usuário já cadastrado')
  await expect(username).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#auth-error-username')).toHaveText('Nome de usuário já cadastrado')
  await expect(page.locator('#auth-error-email')).toHaveText('E-mail já cadastrado')
  await expect(username).toHaveValue('colecionador.a')
  await expect(email).toHaveValue('colecionador.a@kurio.test')
})

for (const destination of ['/cart', '/checkout']) {
  test(`signup returns to ${destination} without requiring a wallet`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:5173/signup?returnTo=${encodeURIComponent(destination)}`)
    await page.getByLabel('Nome de usuário').fill(`novo-${destination.slice(1)}`)
    await page.getByLabel('E-mail', { exact: true }).fill(`${destination.slice(1)}@kurio.test`)
    await page.getByLabel('Senha', { exact: true }).fill('DemoNova!2026')
    await page.getByLabel('Confirmar senha').fill('DemoNova!2026')
    await page.getByRole('button', { name: 'Criar perfil' }).click()
    await expect(page).toHaveURL(`http://127.0.0.1:5173${destination}`)
    if (destination === '/checkout') await expect(page.getByText('Você ainda não cadastrou uma carteira.')).toBeVisible()
  })
}

for (const reference of [
  { path: '/login', fieldYs: [312, 374], submitY: 492, socialY: 592, switchY: 756 },
  { path: '/signup', fieldYs: [312, 374, 436, 498], submitY: 588, socialY: 688, switchY: 852 },
]) {
  test(`mobile ${reference.path} follows the reference field and action geometry`, async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 })
    await page.goto(`http://127.0.0.1:5173${reference.path}`)
    await expect(page.locator('.auth-fields input').first()).toBeVisible()
    const actual = await page.evaluate(() => {
      const y = (element: Element) => Math.round(element.getBoundingClientRect().y)
      return {
        fieldYs: [...document.querySelectorAll('.auth-fields input')].map(y),
        submitY: y(document.querySelector('.auth-submit')!),
        socialY: y(document.querySelector('.auth-social')!),
        switchY: y(document.querySelector('.auth-switch')!),
      }
    })
    expect(actual).toEqual({ fieldYs: reference.fieldYs, submitY: reference.submitY, socialY: reference.socialY, switchY: reference.switchY })
    for (const field of await page.locator('.auth-fields input').all()) {
      const rect = await field.boundingBox()
      expect(rect).toMatchObject({ x: 28, width: 358, height: 50 })
      await expect(field).toHaveCSS('font-size', '14px')
      await expect(field).toHaveCSS('line-height', '16px')
    }
    expect(await page.locator('.auth-submit').boundingBox()).toMatchObject({ x: 28, width: 358, height: 60 })
  })
}
