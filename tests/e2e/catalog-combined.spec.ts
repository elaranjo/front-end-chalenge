import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`catálogo combina filtros, reinicia página e restaura histórico em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto('http://127.0.0.1:5173/')
    const pages = page.getByRole('navigation', { name: 'Páginas do catálogo' })
    const secondPage = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/nfts' && url.searchParams.get('page') === '2' && response.ok()
    })
    await pages.getByRole('button', { name: '2', exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2')
    const secondPageData = await (await secondPage).json()
    expect(secondPageData.page).toBe(2)
    expect(secondPageData.items.length).toBeGreaterThan(0)
    await expect(page.locator('.home-grid .home-card-name')).toHaveText(secondPageData.items.map((item: { name: string }) => item.name))

    const expected = (url: URL) => url.searchParams.get('q') === 'Ape' && url.searchParams.getAll('category').length === 2 && url.searchParams.getAll('network').length === 2 && url.searchParams.get('min') === '0.5' && url.searchParams.get('max') === '2' && url.searchParams.get('sort') === 'price-asc'
    const catalogResponse = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/nfts' && response.request().method() === 'GET' && expected(url) && response.ok()
    })

    if (width === 390) {
      await page.getByRole('button', { name: 'Filtros' }).click()
      const dialog = page.getByRole('dialog', { name: 'Filtros' })
      await dialog.getByLabel(/Arte digital/).check()
      await dialog.getByLabel(/Fotografia/).check()
      await dialog.getByLabel(/Ethereum/).check()
      await dialog.getByLabel(/Polygon/).check()
      await dialog.getByLabel('Preço mínimo em ETH').fill('0.5')
      await dialog.getByLabel('Preço máximo em ETH').fill('2')
      await dialog.getByLabel('Ordenar por:').selectOption('price-asc')
      await dialog.getByRole('button', { name: 'Aplicar filtros' }).click()
      await page.getByLabel('Explorar coleções').fill('Ape')
    } else {
      const filters = page.locator('.home-filter-panel')
      await filters.getByLabel(/Arte digital/).check()
      await filters.getByLabel(/Fotografia/).check()
      await filters.getByLabel(/Ethereum/).check()
      await filters.getByLabel(/Polygon/).check()
      await filters.getByLabel('Preço mínimo em ETH', { exact: true }).fill('0.5')
      await filters.getByLabel('Preço máximo em ETH', { exact: true }).fill('2')
      await filters.getByRole('button', { name: 'Aplicar', exact: true }).click()
      await page.getByLabel('Ordenar por:').selectOption('price-asc')
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await page.locator('#desktop-search').fill('Ape')
    }
    await expect.poll(() => expected(new URL(page.url()))).toBe(true)
    expect(new URL(page.url()).searchParams.has('page')).toBe(false)
    const response = await (await catalogResponse).json()
    expect(response.items.length).toBeGreaterThan(0)
    for (const item of response.items) {
      expect(`${item.name} ${item.collection}`.toLowerCase()).toContain('ape')
      expect(['Arte digital', 'Fotografia']).toContain(item.category)
      expect(['ethereum', 'polygon']).toContain(item.network)
      expect(Number(item.editions[0].unitPrice)).toBeGreaterThanOrEqual(0.5)
      expect(Number(item.editions[0].unitPrice)).toBeLessThanOrEqual(2)
    }
    expect(new Set(response.items.map((item: { category: string }) => item.category))).toEqual(new Set(['Arte digital', 'Fotografia']))
    expect(new Set(response.items.map((item: { network: string }) => item.network))).toEqual(new Set(['ethereum', 'polygon']))
    const prices = response.items.map((item: { editions: { unitPrice: string }[] }) => Number(item.editions[0].unitPrice))
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    await expect(page.locator('.home-grid .home-card')).toHaveCount(response.items.length)
    await expect(page.locator('.home-grid .home-card-name')).toHaveText(response.items.map((item: { name: string }) => item.name))
    await page.reload()
    await expect.poll(() => expected(new URL(page.url()))).toBe(true)
    await page.goBack()
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).not.toBe('Ape')
    await page.goForward()
    await expect.poll(() => expected(new URL(page.url()))).toBe(true)
  })
}

for (const width of [390, 1440]) {
  test(`resposta antiga não substitui busca recente em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const firstRequest = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return url.pathname === '/api/v1/nfts' && request.method() === 'GET' && !url.searchParams.has('q')
    })
    await page.goto('http://127.0.0.1:5173/?mockScenario=out-of-order')
    const oldRequest = await firstRequest
    let oldSettled = false
    const settled = new Promise<{ outcome: 'finished' | 'cancelled'; at: number }>((resolve) => {
      page.on('requestfinished', (request) => { if (request === oldRequest) { oldSettled = true; resolve({ outcome: 'finished', at: Date.now() }) } })
      page.on('requestfailed', (request) => { if (request === oldRequest) { oldSettled = true; resolve({ outcome: 'cancelled', at: Date.now() }) } })
    })
    const newerResponse = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/nfts' && url.searchParams.get('q') === 'Golden' && response.ok()
    })
    if (width === 390) await page.getByLabel('Explorar coleções').fill('Golden')
    else {
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await page.locator('#desktop-search').fill('Golden')
    }
    expect(oldSettled).toBe(false)
    const response = await newerResponse
    const newerAt = Date.now()
    const payload = await response.json()
    expect(payload.items.length).toBeGreaterThan(0)
    await expect(page.locator('.home-grid .home-card-name')).toHaveText(payload.items.map((item: { name: string }) => item.name))
    const old = await settled
    expect(old.outcome === 'cancelled' || old.at >= newerAt).toBe(true)
    await expect(page.locator('.home-grid .home-card-name')).toHaveText(payload.items.map((item: { name: string }) => item.name))
    expect(new URL(page.url()).searchParams.get('q')).toBe('Golden')
  })
}
