import { expect, test } from '@playwright/test'

test('MSW binding exchanges Socket.IO messages with a real browser client', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/tests/fixtures/socket-probe.html')
  await expect(page.locator('body')).toHaveAttribute('data-result', '{"value":"verified"}', { timeout: 5000 })
})
