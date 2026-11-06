import { expect, test } from '@playwright/test'

for (const width of [390, 414, 768]) {
  test(`filter dialog traps and restores keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 896 })
    await page.goto('http://127.0.0.1:5173/')
    const trigger = page.getByRole('button', { name: 'Filtros', exact: true })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Filtros' })
    await expect(dialog).toBeVisible()
    const first = dialog.getByLabel(/Arte digital/)
    const last = dialog.getByRole('button', { name: 'Fechar', exact: true })
    await first.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(last).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(first).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
  })
}
