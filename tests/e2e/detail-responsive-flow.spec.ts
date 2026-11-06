import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`detail gallery, add and buy work through UI and network at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
    const trigger = page.getByRole('button', { name: 'Ampliar imagem' })
    await trigger.click()
    const gallery = page.getByRole('dialog', { name: 'Imagem ampliada' })
    await expect(gallery.getByText('Imagem 1 de 4')).toBeVisible()
    await expect(gallery.getByRole('button', { name: 'Fechar imagem' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(gallery.getByRole('button', { name: 'Próxima imagem' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(gallery.getByText('Imagem 2 de 4')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()

    await page.getByRole('button', { name: '1/10', exact: true }).click()
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    const added = page.waitForResponse((response) => response.url().endsWith('/api/v1/cart/items') && response.request().method() === 'POST' && response.ok())
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    const request = (await added).request().postDataJSON()
    expect(request).toMatchObject({ nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 })
    await expect(page.getByRole('status').filter({ hasText: 'NFT adicionado ao carrinho.' })).toBeVisible()
    await expect(page).toHaveURL(/\/nfts\/emerald-ape-042$/)

    const bought = page.waitForResponse((response) => response.url().endsWith('/api/v1/cart/items') && response.request().method() === 'POST' && response.ok())
    await page.getByRole('button', { name: 'Comprar NFT', exact: true }).click()
    expect((await bought).request().postDataJSON()).toMatchObject({ nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 })
    await expect(page).toHaveURL(/\/cart$/)
    await expect(page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' }).locator('.cart-stepper span')).toHaveText('4')

    await page.goto('http://127.0.0.1:5173/nfts/inexistente')
    await expect(page.getByRole('alert')).toHaveText('Não foi possível encontrar este NFT.')
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible()
  })
}
