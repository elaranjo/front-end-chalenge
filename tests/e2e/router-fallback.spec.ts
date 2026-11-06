import { expect, test } from '@playwright/test'

test('an unknown direct URL offers a return to the application root', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/rota-inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao início' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
})

test('direct NFT route and refresh load data over the mock API in the optimized build', async ({ page }) => {
  const response = page.waitForResponse((entry) => entry.url().endsWith('/api/v1/nfts/emerald-ape-042') && entry.ok())
  await page.goto('http://127.0.0.1:4173/nfts/emerald-ape-042')
  expect((await response).request().method()).toBe('GET')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  const reloadResponse = page.waitForResponse((entry) => entry.url().endsWith('/api/v1/nfts/emerald-ape-042') && entry.ok())
  await page.reload()
  await reloadResponse
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
})

test('a direct private route requires login and retains its return path', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/checkout')
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fcheckout/)
  await expect(page.getByRole('dialog', { name: 'Autenticação' })).toBeVisible()
})
