import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

test('desktop cart shows navigation, cart count and catalog recommendations', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-desktop')
  await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()
  const count = await page.locator('.cart-stepper span').allTextContents()
  const total = count.reduce((sum, quantity) => sum + Number(quantity), 0)
  await expect(page.getByRole('link', { name: `Carrinho, ${total} itens` })).toBeVisible()
  const recommendations = page.getByRole('region', { name: 'Colecionadores também viram' })
  await expect(recommendations.locator('article')).toHaveCount(5)
  await expect(recommendations.locator('article a > span:not(.cart-recommendation-art)')).toHaveText([
    'Cosmic Bloom #118', 'Violet Nomad #314', 'Ivory Baron #088', 'Golden Beat #207', 'Golden Signal #160',
  ])
  await expect(recommendations.locator('article a').first()).toHaveAttribute('href', /\/nfts\//)
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
  const totals = page.locator('.cart-totals > div')
  for (const [index, expectedY, labelSize, valueSize] of [[0, 269, '15px', '18px'], [1, 301, '15px', '15px'], [2, 333, '15px', '18px'], [3, 405, '16px', '18px']] as const) {
    const row = totals.nth(index)
    expect((await row.boundingBox())!.y).toBeCloseTo(expectedY, 0)
    await expect(row.locator('dt')).toHaveCSS('font-size', labelSize)
    await expect(row.locator('dd')).toHaveCSS('font-size', valueSize)
  }
  expect((await page.locator('.cart-checkout').boundingBox())!.y).toBeCloseTo(445, 0)
  const artworkSizes = await recommendations.locator('article img').evaluateAll((images) => images.map((image) => { const rect = image.getBoundingClientRect(); return [Math.round(rect.width), Math.round(rect.height)] }))
  expect(artworkSizes).toEqual([[190, 243], [212, 212], [212, 212], [213, 213], [213, 213]])
  const geometry = await page.evaluate(() => ({ recommendations: Math.round(document.querySelector('.cart-recommendations')!.getBoundingClientRect().y), footer: Math.round(document.querySelector('.site-footer')!.getBoundingClientRect().y), height: document.documentElement.scrollHeight }))
  expect(geometry).toEqual({ recommendations: 613, footer: 1120, height: 1754 })
  await page.screenshot({ path: 'tmp/cart-desktop.png', fullPage: true })
})

test('tablet cart keeps its controls within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-desktop')
  await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Remover Emerald Ape #042' })).toBeVisible()
  const bounds = await page.evaluate(() => {
    const line = document.querySelector('.cart-line')!.getBoundingClientRect()
    const remove = document.querySelector('.cart-remove')!.getBoundingClientRect()
    return { viewport: window.innerWidth, document: document.documentElement.scrollWidth, lineRight: line.right, removeRight: remove.right }
  })
  expect(bounds.document).toBeLessThanOrEqual(bounds.viewport)
  expect(bounds.removeRight).toBeLessThanOrEqual(bounds.lineRight)
})
