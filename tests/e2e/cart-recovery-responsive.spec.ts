import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`background refresh failure preserves the cart and recovers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
    const checkout = page.getByRole('button', { name: 'Conectar e finalizar' })
    const item = page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })
    await expect(checkout).toBeEnabled()
    const action = (body: object) => page.evaluate(async (value) => (await fetch('/api/v1/__mock/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
    })).ok, body)
    expect(await action({ action: 'setCartReadFailure', payload: { enabled: true } })).toBe(true)
    expect(await action({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '2.50' } })).toBe(true)
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível atualizar o carrinho' })
    await expect(error).toBeVisible({ timeout: 15000 })
    await expect(item.locator('b')).toHaveText('1.19 ETH')
    await expect(checkout).toBeDisabled()
    expect(await action({ action: 'setCartReadFailure', payload: { enabled: false } })).toBe(true)
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(item.locator('b')).toHaveText('2.5 ETH', { timeout: 15000 })
    await expect(checkout).toBeEnabled()
  })
  for (const scenario of ['http-400', 'http-409', 'http-422', 'http-500', 'http-503', 'network-error']) {
    test(`cart recovers from ${scenario} without mutations at ${width}px`, async ({ page }) => {
      test.setTimeout(60000)
      await page.setViewportSize({ width, height: 900 })
      const mutations: string[] = []
      page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.pathname.startsWith('/api/v1/cart') && request.method() !== 'GET') mutations.push(`${request.method()} ${url.pathname}`)
      })
      await page.goto(`http://127.0.0.1:5173/cart?mockScenario=${scenario}`)
      const summary = page.getByRole('region', { name: 'Resumo da carteira' })
      const checkout = summary.getByRole('button', { name: 'Conectar e finalizar' })
      await expect(summary.getByRole('alert')).toContainText('Resumo indisponível.', { timeout: 15000 })
      await expect(checkout).toBeDisabled()
      const retry = scenario === 'network-error'
        ? page.waitForEvent('requestfailed', (request) => request.url().endsWith('/api/v1/cart') && request.method() === 'GET')
        : page.waitForResponse((response) => response.url().endsWith('/api/v1/cart') && response.status() === Number(scenario.slice(5)))
      await summary.getByRole('button', { name: 'Tentar novamente' }).click()
      await retry
      await expect(summary.getByRole('alert')).toContainText('Resumo indisponível.', { timeout: 15000 })
      expect(mutations).toEqual([])
      const reset = await page.evaluate(async () => (await fetch('/api/v1/__mock/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'visual-mobile', clockMode: 'real' }),
      })).ok)
      expect(reset).toBe(true)
      await expect(summary.getByText('8.156 ETH')).toBeVisible({ timeout: 15000 })
      await expect(checkout).toBeEnabled()
      expect(mutations).toEqual([])
    })
  }
}
