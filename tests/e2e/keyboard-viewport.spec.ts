import { expect, test } from '@playwright/test'

for (const width of [390, 768, 1440]) {
  test(`signup controls remain reachable with a reduced viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('http://127.0.0.1:5173/signup')
    const form = width >= 768 ? page.getByRole('dialog', { name: 'Autenticação' }) : page.locator('main')
    const confirmation = form.getByLabel('Confirmar senha')
    await expect(confirmation).toBeVisible()
    // A shorter visual viewport approximates space occupied by an onscreen keyboard;
    // it does not emulate a real device keyboard or browser chrome.
    await page.setViewportSize({ width, height: 400 })
    await confirmation.focus()
    await expect(confirmation).toBeFocused()
    await confirmation.scrollIntoViewIfNeeded()
    const button = form.getByRole('button', { name: width >= 768 ? 'Criar conta' : 'Criar perfil', exact: true })
    await button.focus()
    await button.scrollIntoViewIfNeeded()
    await expect(button).toBeFocused()
    const hit = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const point = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return rect.top >= 0 && rect.bottom <= innerHeight && (point === element || element.contains(point))
    })
    expect(hit).toBe(true)
  })
}
