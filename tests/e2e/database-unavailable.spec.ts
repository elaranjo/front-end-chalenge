import { expect, test } from '@playwright/test'

test('unavailable IndexedDB stops bootstrap with a recoverable error', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(indexedDB, 'open', { value: () => { throw new DOMException('Simulated unavailable storage', 'InvalidStateError') } })
  })
  await page.goto('http://127.0.0.1:5173/')
  await expect(page.getByRole('alert')).toContainText('Não foi possível iniciar a aplicação')
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible()
  await expect(page.locator('.home-page')).toHaveCount(0)
})
