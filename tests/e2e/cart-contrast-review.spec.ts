import { expect, test } from '@playwright/test'

for (const width of [390, 414, 768, 1440]) {
  test(`cart controls flagged by axe have identifiable states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 414 ? 896 : 1080 })
    await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
    const lines = page.locator('.cart-line')
    await expect(lines).toHaveCount(4)
    for (const index of [2, 3]) {
      const line = lines.nth(index)
      const quantity = Number(await line.locator('.cart-stepper span').innerText())
      const decrease = line.getByRole('button', { name: /Diminuir quantidade/ })
      if (quantity > 1) await expect(decrease).toBeEnabled()
      else await expect(decrease).toBeDisabled()
    }
    const increase = lines.first().getByRole('button', { name: /Aumentar quantidade/ })
    await expect(increase).toBeEnabled()
    const colors = await increase.evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }))
    expect(colors).toEqual(width < 768
      ? { color: 'rgb(245, 241, 235)', background: 'rgb(47, 29, 21)' }
      : { color: 'rgb(20, 13, 10)', background: 'rgb(210, 138, 76)' })
  })
}
