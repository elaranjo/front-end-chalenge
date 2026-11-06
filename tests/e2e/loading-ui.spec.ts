import { expect, test } from '@playwright/test'

for (const width of [390, 414, 768, 1440]) {
  test(`catalog loading reserves the card grid at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://127.0.0.1:5173/?mockScenario=slow')
    const loading = page.getByRole('status', { name: 'Carregando NFTs' })
    await expect(loading).toBeVisible()
    const skeletons = await loading.locator('.loading-image').evaluateAll((elements) => elements.slice(0, 2).map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height, y: rect.y }
    }))
    const columns = await loading.locator(':scope > div').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
    expect(columns).toBe(width < 1280 ? 2 : 3)
    const cardImage = page.locator('.home-card-image').first()
    await expect(cardImage).toBeVisible({ timeout: 15000 })
    const actual = await page.locator('.home-card-image').evaluateAll((elements) => elements.slice(0, 2).map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height, y: rect.y }
    }))
    expect(skeletons).toHaveLength(2)
    expect(actual).toHaveLength(2)
    expect(Math.abs(skeletons[0].width - actual[0].width)).toBeLessThan(1)
    expect(Math.abs(skeletons[0].height - actual[0].height)).toBeLessThan(1)
    expect(Math.abs((skeletons[1].y - skeletons[0].y) - (actual[1].y - actual[0].y))).toBeLessThan(1)
  })
}

for (const width of [390, 414, 768, 1440]) {
  test(`detail loading reserves the artwork at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042?mockScenario=slow')
    const image = page.getByRole('status', { name: 'Carregando NFT' }).locator('.loading-detail-image')
    await expect(image).toBeVisible()
    const placeholder = await image.boundingBox()
    const artwork = page.locator('.detail-image-button > img')
    await expect(artwork).toBeVisible({ timeout: 15000 })
    const actual = await artwork.boundingBox()
    for (const axis of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(placeholder![axis] - actual![axis]), `${axis}: ${JSON.stringify({ placeholder, actual })}`).toBeLessThan(1)
  })
}

for (const width of [390, 768, 1440]) {
  test(`cart summary loading reserves the totals at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://127.0.0.1:5173/cart?mockScenario=slow')
    await expect(page.getByRole('status', { name: 'Carregando resumo' })).toBeVisible()
    const action = page.getByRole('button', { name: 'Conectar e finalizar' })
    const summary = page.getByRole('region', { name: 'Resumo da carteira' })
    const parentBefore = await summary.boundingBox()
    const before = await action.boundingBox()
    await expect(page.locator('.cart-totals')).toBeVisible({ timeout: 15000 })
    const after = await action.boundingBox()
    const parentAfter = await summary.boundingBox()
    expect(Math.abs((before!.y - parentBefore!.y) - (after!.y - parentAfter!.y))).toBeLessThan(2)
  })
}

for (const width of [390, 414, 768, 1440]) {
test(`slow catalog, detail and cart expose skeletons with reduced motion at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 896 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:5173/?mockScenario=slow')
  const catalog = page.getByRole('status', { name: 'Carregando NFTs' })
  await expect(catalog).toBeVisible()
  await expect(catalog.locator('.loading-image').first()).toHaveCSS('animation-name', 'none')
  await expect(page.locator('a[href="/nfts/emerald-ape-042"]')).toBeVisible({ timeout: 15000 })
  await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
  const detail = page.getByRole('status', { name: 'Carregando NFT' })
  await expect(detail).toBeVisible()
  await expect(detail.locator('.loading-detail-image')).toHaveCSS('animation-name', 'none')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15000 })
  await page.goto('http://127.0.0.1:5173/cart')
  const summary = page.getByRole('status', { name: 'Carregando resumo' })
  await expect(summary).toBeVisible()
  await expect(summary.locator('.loading-totals span').first()).toHaveCSS('animation-name', 'none')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible({ timeout: 15000 })
})
}

test('cart summary reports a failed request and exposes retry', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=http-503')
  const summary = page.getByRole('region', { name: 'Resumo da carteira' })
  await expect(summary.getByRole('alert')).toContainText('Resumo indisponível.', { timeout: 15000 })
  const retry = page.waitForResponse((response) => response.url().endsWith('/api/v1/cart') && response.status() === 503)
  await summary.getByRole('button', { name: 'Tentar novamente' }).click()
  await retry
})

test('cart recovers after a failing scenario is reset', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=http-503')
  const summary = page.getByRole('region', { name: 'Resumo da carteira' })
  const checkout = summary.getByRole('button', { name: 'Conectar e finalizar' })
  await expect(summary.getByRole('alert')).toContainText('Resumo indisponível.', { timeout: 15000 })
  await expect(checkout).toBeDisabled()
  const reset = await page.evaluate(async () => (await fetch('/api/v1/__mock/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'visual-mobile', clockMode: 'real' }),
  })).ok)
  expect(reset).toBe(true)
  await expect(summary.getByText('8.156 ETH')).toBeVisible({ timeout: 15000 })
  await expect(checkout).toBeEnabled()
})

for (const scenario of ['http-400', 'http-409', 'http-422', 'http-500', 'network-error'] as const) {
  test(`cart recovers from ${scenario} without a cart mutation`, async ({ page }) => {
    const mutations: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname.startsWith('/api/v1/cart') && request.method() !== 'GET') mutations.push(`${request.method()} ${url.pathname}`)
    })
    await page.goto(`http://127.0.0.1:5173/cart?mockScenario=${scenario}`)
    const summary = page.getByRole('region', { name: 'Resumo da carteira' })
    const checkout = summary.getByRole('button', { name: 'Conectar e finalizar' })
    await expect(summary.getByRole('alert')).toContainText('Resumo indisponível.', { timeout: 15000 })
    await expect(checkout).toBeDisabled()
    const retryResult = scenario === 'network-error'
      ? page.waitForEvent('requestfailed', (request) => request.url().endsWith('/api/v1/cart') && request.method() === 'GET')
      : page.waitForResponse((response) => response.url().endsWith('/api/v1/cart') && response.status() === Number(scenario.slice(5)))
    await summary.getByRole('button', { name: 'Tentar novamente' }).click()
    await retryResult
    await expect(summary.getByRole('alert')).toContainText('Resumo indisponível.', { timeout: 15000 })
    expect(mutations).toEqual([])
    const reset = await page.evaluate(async () => (await fetch('/api/v1/__mock/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'visual-mobile', clockMode: 'real' }),
    })).ok)
    expect(reset).toBe(true)
    await expect(summary.getByText('8.156 ETH')).toBeVisible({ timeout: 15000 })
    await expect(checkout).toBeEnabled()
    expect(mutations).toEqual([])
  })
}

test('reset while a slow cart request is in flight preserves the new fixture owner', async ({ page }) => {
  const oldCartRequest = page.waitForRequest((request) => request.url().endsWith('/api/v1/cart') && request.method() === 'GET')
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=slow')
  await oldCartRequest
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/v1/__mock/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'visual-mobile', clockMode: 'real' }) })
    return { ok: response.ok, body: await response.json() }
  })
  expect(result.ok).toBe(true)
  await expect(page.getByRole('region', { name: 'Resumo da carteira' }).getByText('8.156 ETH')).toBeVisible({ timeout: 15000 })
  const ownership = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('kurio-mock')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = db.transaction('scenario', 'readonly')
    const claim = await new Promise<any>((resolve, reject) => {
      const request = tx.objectStore('scenario').get('visual-cart-claim')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return { claim: claim?.owner, visitor: localStorage.getItem('kurio.visitor-id') }
  })
  expect(ownership.visitor).toBe(result.body.generation)
  expect(ownership.claim).toBe(`visitor:${result.body.generation}`)
})

test('reset during a failed-cart retry does not assign the fixture to a stale visitor', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/cart?mockScenario=http-400')
  const summary = page.getByRole('region', { name: 'Resumo da carteira' })
  await expect(summary.getByRole('alert')).toContainText('Resumo indisponível.', { timeout: 15000 })
  await summary.getByRole('button', { name: 'Tentar novamente' }).click()
  const reset = await page.evaluate(async () => {
    const response = await fetch('/api/v1/__mock/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'visual-mobile', clockMode: 'real' }) })
    return { ok: response.ok, body: await response.json() }
  })
  expect(reset.ok).toBe(true)
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('kurio-mock'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    return new Promise<string | null>((resolve, reject) => { const tx = db.transaction('scenario', 'readonly'); const request = tx.objectStore('scenario').get('visual-cart-claim'); request.onsuccess = () => resolve(request.result?.owner ?? null); request.onerror = () => reject(request.error) })
  }), { timeout: 15000 }).toBe(`visitor:${reset.body.generation}`)
  await expect(summary.getByText('8.156 ETH')).toBeVisible({ timeout: 15000 })
})
