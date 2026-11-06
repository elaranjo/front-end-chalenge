import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'reduce' })

for (const profile of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
  for (const screen of ['home', 'detail', 'cart', 'checkout'] as const) {
    test(`visual regression ${screen} ${profile.name}`, async ({ page }) => {
      test.setTimeout(60000)
      await page.setViewportSize({ width: profile.width, height: profile.height })
      const scenario = profile.name === 'mobile' ? 'visual-mobile' : 'visual-desktop'
      if (screen === 'home') {
        await page.goto(`/?mockScenario=${scenario}`)
        await expect(page.locator('.home-card').first()).toBeVisible()
      } else if (screen === 'detail') {
        await page.goto(`/nfts/emerald-ape-042?mockScenario=${scenario}`)
        await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
      } else {
        await page.goto(`/cart?mockScenario=${scenario}`)
        await expect(page.locator('.cart-line').first()).toBeVisible()
        await expect(page.locator('.cart-totals')).toBeVisible()
        if (screen === 'checkout') {
          await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
          await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
          await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
          await page.getByRole('button', { name: 'Entrar', exact: true }).click()
          await expect(page).toHaveURL(/\/checkout$/)
          await page.evaluate(async () => {
            const token = localStorage.getItem('kurio.session-token')!
            const wallet = { displayName: 'Colecionador', nickname: 'Principal', network: 'ethereum', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'colecionador' }
            const response = await fetch('/api/v1/wallets/primary', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'If-Match': '0' }, body: JSON.stringify(wallet) })
            if (!response.ok) throw new Error(`wallet: ${response.status}`)
          })
          await page.reload()
          await page.getByLabel(/Carteira principal — Principal/).click()
          if (profile.name === 'mobile') await page.getByRole('button', { name: 'Continuar', exact: true }).click()
          await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
          await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeEnabled()
        }
      }
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.mouse.move(0, 0)
      await expect(page).toHaveScreenshot(`${screen}-${profile.name}.png`, { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 })
    })
  }
}
