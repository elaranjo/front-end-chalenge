import { expect, test, type Locator } from '@playwright/test'

async function solidContrast(control: Locator, surface: string) {
  return control.evaluate((element, selector) => {
    const luminance = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
      const channel = value / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const foreground = luminance(getComputedStyle(element).color)
    const background = luminance(getComputedStyle(element.closest(selector)!).backgroundColor)
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
  }, surface)
}

test('contraste dos sufixos ENS no perfil e pagamento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 896 })
  await page.goto('/login?returnTo=%2Fprofile')
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  for (const width of [390, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 1080 })
    const suffix = page.getByLabel('Sufixo ENS', { exact: true })
    await expect(suffix).toBeVisible()
    expect(await solidContrast(suffix, '.wallet-page')).toBeGreaterThanOrEqual(4.5)
  }
  await page.goto('/checkout')
  for (const width of [390, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 1080 })
    const suffix = page.getByLabel('Sufixo ENS', { exact: true })
    await expect(suffix).toBeVisible()
    expect(await solidContrast(suffix, '.checkout-page')).toBeGreaterThanOrEqual(4.5)
  }
})
