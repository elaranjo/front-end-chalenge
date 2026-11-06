import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 414, height: 896 } })

test('detail adds the selected edition and quantity to the visitor cart', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
  await page.screenshot({ path: 'tmp/detail-mobile.png' })
  await page.screenshot({ path: 'tmp/detail-mobile-full.png', fullPage: true })
  await page.getByRole('button', { name: '1/10', exact: true }).click()
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('status')).toHaveText('NFT adicionado ao carrinho.')
  const lines = await page.evaluate(async () => {
    const visitor = localStorage.getItem('kurio.visitor-id')!
    const response = await fetch('/api/v1/cart', { headers: { 'X-Visitor-Id': visitor } })
    return (await response.json()).lines.map((line: { nftId: string; editionId: string; quantity: number }) => ({ nftId: line.nftId, editionId: line.editionId, quantity: line.quantity }))
  })
  expect(lines).toEqual([{ nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 }])
})

test('buy navigates only after adding the selected edition and quantity', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  await page.getByRole('button', { name: '1/10', exact: true }).click()
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'Comprar NFT', exact: true }).click()
  await expect(page).toHaveURL(/\/cart$/)
  const line = page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })
  await expect(line.getByText('Edição: 1/10')).toBeVisible()
  await expect(line.locator('.cart-stepper span')).toHaveText('2')
  await expect(line.locator('b')).toHaveText('2.38 ETH')
})

test('buy keeps the selection on a cart failure and succeeds on retry', async ({ page }) => {
  const initialCart = page.waitForResponse((response) => response.url().endsWith('/api/v1/cart') && response.status() === 200)
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  await initialCart
  await page.getByRole('button', { name: '1/10', exact: true }).click()
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  const setFault = (enabled: boolean) => page.evaluate(async (value) => (await fetch('/api/v1/__mock/actions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'setCartReadFailure', payload: { enabled: value } }),
  })).ok, enabled)
  expect(await setFault(true)).toBe(true)
  const buy = page.getByRole('button', { name: 'Comprar NFT', exact: true })
  await buy.click()
  await expect(page.getByRole('status').filter({ hasText: 'Não foi possível adicionar ao carrinho' })).toBeVisible()
  await expect(page).toHaveURL(/\/nfts\/emerald-ape-042$/)
  await expect(page.getByRole('button', { name: '1/10', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await setFault(false)).toBe(true)
  await buy.click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' }).locator('.cart-stepper span')).toHaveText('2')
})

test('unknown NFT displays a recoverable not-found state', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/nfts/inexistente')
  await expect(page.getByRole('alert')).toHaveText('Não foi possível encontrar este NFT.')
  await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible()
})

test('detail explains a live stock reduction and allows correcting quantity', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  const buy = page.getByRole('button', { name: 'Comprar NFT', exact: true })
  await expect(buy).toBeEnabled()
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  const changed = await page.evaluate(async () => (await fetch('/api/v1/__mock/actions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', available: 1 } }),
  })).ok)
  expect(changed).toBe(true)
  await expect(page.getByRole('alert')).toContainText('Estoque disponível: 1')
  await expect(buy).toBeDisabled()
  await page.getByRole('button', { name: 'Diminuir quantidade' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(buy).toBeEnabled()
})

for (const width of [390, 1440]) {
  test(`sold-out editions and stock limits are enforced at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042?mockScenario=sold-out')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('button', { name: '1/1', exact: true })).toBeDisabled()
    const changed = await page.evaluate(async () => (await fetch('/api/v1/__mock/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-ten', available: 2 } }),
    })).ok)
    expect(changed).toBe(true)
    const edition = page.getByRole('button', { name: '1/10', exact: true })
    await expect(edition).toBeEnabled()
    await edition.click()
    const increase = page.getByRole('button', { name: 'Aumentar quantidade' })
    await expect.poll(async () => {
      const response = await page.evaluate(async () => (await fetch('/api/v1/nfts/emerald-ape-042')).json())
      return response.editions.find((item: { id: string }) => item.id === 'one-of-ten')?.available
    }).toBe(2)
    await increase.click()
    await expect(increase).toBeDisabled()
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'NFT adicionado ao carrinho.' })).toBeVisible()
    const cart = await page.evaluate(async () => {
      const visitor = localStorage.getItem('kurio.visitor-id')!
      return (await (await fetch('/api/v1/cart', { headers: { 'X-Visitor-Id': visitor } })).json()).lines
    })
    expect(cart).toHaveLength(1)
    expect(cart[0]).toMatchObject({ nftId: 'emerald-ape-042', editionId: 'one-of-ten', quantity: 2 })
  })
}

for (const width of [390, 768]) {
  test(`detail controls remain reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
    const buy = page.getByRole('button', { name: 'Comprar NFT', exact: true })
    await expect(buy).toBeEnabled()
    await buy.scrollIntoViewIfNeeded()
    const geometry = await page.evaluate(() => {
      const button = document.querySelector('.detail-actions > button')!.getBoundingClientRect()
      return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, buttonLeft: button.left, buttonRight: button.right }
    })
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport)
    expect(geometry.buttonLeft).toBeGreaterThanOrEqual(0)
    expect(geometry.buttonRight).toBeLessThanOrEqual(geometry.viewport)
  })
}

test('image dialog supports keyboard gallery navigation and restores focus', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  const trigger = page.getByRole('button', { name: 'Ampliar imagem' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Imagem ampliada' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Fechar imagem' })).toBeFocused()
  await expect(dialog.getByText('Imagem 1 de 4')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByText('Imagem 2 de 4')).toBeVisible()
  await dialog.getByRole('button', { name: 'Imagem anterior' }).click()
  await expect(dialog.getByText('Imagem 1 de 4')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('detail tabs show available data and related NFTs navigate to their own pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()
  await expect(page.getByText('Início / Mercado', { exact: true })).toBeVisible()
  const stars = page.locator('.detail-desktop-reviews i')
  await expect(stars).toHaveCount(5)
  await expect(stars.first()).toHaveCSS('width', '15px')
  await expect(stars.first()).toHaveCSS('background-color', 'rgb(210, 138, 76)')
  await expect(stars.last()).toHaveCSS('background-color', 'rgb(207, 178, 140)')
  const share = page.getByRole('link', { name: 'Compartilhar no LinkedIn' })
  await expect(share).toBeVisible()
  expect(await share.boundingBox()).toMatchObject({ width: 15, height: 14.375 })
  await expect(share.locator('img')).toHaveAttribute('src', '/assets/icons/context-ff3cb7cf633dbe6f.svg')
  await expect(page.getByRole('link', { name: 'Compartilhar por e-mail' }).locator('img')).toHaveAttribute('src', '/assets/icons/context-3b1d83e85ce80e2c.svg')
  await expect(page.getByRole('link', { name: 'Compartilhar no Twitter' }).locator('img')).toHaveAttribute('src', '/assets/icons/context-6c4b682b4ed5eb78.svg')
  const shareUrl = new URL((await share.getAttribute('href'))!)
  expect(shareUrl.searchParams.get('url')).toBe(page.url())
  await expect(page.getByRole('link', { name: 'Compartilhar por e-mail' })).toHaveAttribute('href', /^mailto:\?/)
  await expect(page.getByRole('region', { name: 'Mais desta coleção' }).locator('article').first()).toBeVisible()
  for (const label of ['Rede:', 'Contrato:', 'Direitos autorais:']) {
    await expect(page.locator('#detail-panel-details strong').filter({ hasText: label })).toHaveCSS('display', 'block')
  }
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
  const desktopGeometry = await page.evaluate(() => {
    const y = (selector: string) => Math.round(document.querySelector(selector)!.getBoundingClientRect().y)
    return { tabs: y('.detail-info-tabs'), related: y('.detail-related h2'), footer: y('.site-footer'), labels: [...document.querySelectorAll('#detail-panel-details strong')].map((element) => Math.round(element.getBoundingClientRect().y)), height: document.documentElement.scrollHeight }
  })
  expect(desktopGeometry).toEqual({ tabs: 673, related: 1109, footer: 1612, labels: [846, 906, 966], height: 2246 })
  const relatedArtwork = await page.locator('.detail-related-art img').evaluateAll((images) => images.map((image) => { const box = image.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } }))
  expect(relatedArtwork).toEqual([{ x: 140, y: 1173, width: 190, height: 243 }, { x: 369, y: 1189, width: 212, height: 212 }, { x: 614, y: 1189, width: 212, height: 212 }, { x: 860, y: 1185, width: 213, height: 213 }, { x: 1105, y: 1185, width: 213, height: 213 }])
  await page.screenshot({ path: 'tmp/detail-desktop.png', fullPage: true })
  const details = page.getByRole('tab', { name: 'Detalhes do NFT' })
  await expect(details).toHaveAttribute('aria-selected', 'true')
  await expect(details).toHaveCSS('font-size', '17px')
  await expect(details).toHaveCSS('font-weight', '700')
  await details.focus()
  await page.keyboard.press('ArrowRight')
  const reviews = page.getByRole('tab', { name: 'Avaliações de colecionadores (19)' })
  await expect(reviews).toBeFocused()
  await expect(page.getByRole('tabpanel', { name: 'Avaliações de colecionadores (19)' })).toContainText('Não há comentários disponíveis.')
  await page.keyboard.press('ArrowLeft')
  await expect(details).toBeFocused()
  const section = page.getByRole('region', { name: 'Mais desta coleção' })
  await expect(section.locator('.detail-related-name')).toHaveText(['Cosmic Bloom #118', 'Violet Nomad #314', 'Ivory Baron #088', 'Golden Beat #207', 'Golden Signal #160'])
  await expect(section.locator('a[href^="/nfts/"]').first()).toBeVisible()
  const destination = await section.locator('a[href^="/nfts/"]').first().getAttribute('href')
  await section.locator('a[href^="/nfts/"]').first().click()
  await expect(page).toHaveURL(new RegExp(`${destination}$`))
})

test('selection cannot change while the add operation is being processed', async ({ page }) => {
  test.setTimeout(45000)
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042?mockScenario=slow')
  const selected = page.getByRole('button', { name: '1/10', exact: true })
  await expect(selected).toBeVisible({ timeout: 15000 })
  await selected.click()
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(selected).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Diminuir quantidade' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'NFT adicionado ao carrinho.' })).toBeVisible({ timeout: 15000 })
  await expect(selected).toBeEnabled()
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
})

test('mobile detail uses the reference hero and sheet geometry at 414px', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => { const box = document.querySelector(selector)!.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) } }
    return { back: rect('.detail-nav a'), artwork: rect('.detail-image-button > img'), sheet: rect('.detail-sheet'), buy: rect('.detail-buy'), action: rect('.detail-actions > button') }
  })
  expect(geometry).toEqual({ back: { x: 28, y: 23, width: 35 }, artwork: { x: 28, y: 66, width: 361 }, sheet: { x: 0, y: 392, width: 414 }, buy: { x: 0, y: 732, width: 414 }, action: { x: 24, y: 802, width: 196 } })
})
