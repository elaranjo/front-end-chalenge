import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('Roboto Mono weights load from the application origin without an external font service', async ({ page }) => {
  const fontRequests: string[] = []
  page.on('request', (request) => { if (request.resourceType() === 'font') fontRequests.push(request.url()) })
  await page.goto('http://127.0.0.1:5173/')
  await expect(page.locator('.home-page')).toBeVisible()
  const result = await page.evaluate(async () => {
    const weights = [400, 500, 700]
    const loaded = await Promise.all(weights.map((weight) => document.fonts.load(`${weight} 16px "Roboto Mono Variable"`, 'áéíóú NFT')))
    return { counts: loaded.map((faces) => faces.length), family: getComputedStyle(document.querySelector('.home-page')!).fontFamily }
  })
  expect(result.counts.every((count) => count > 0)).toBe(true)
  expect(result.family).toContain('Roboto Mono Variable')
  expect(fontRequests.length).toBeGreaterThan(0)
  expect(fontRequests.every((url) => new URL(url).origin === 'http://127.0.0.1:5173')).toBe(true)
  await page.context().setOffline(true)
  try {
    const available = await page.evaluate(async () => {
      await document.fonts.ready
      return [400, 500, 700].every((weight) => document.fonts.check(`${weight} 16px "Roboto Mono Variable"`, 'áéíóú NFT'))
    })
    expect(available).toBe(true)
  } finally { await page.context().setOffline(false) }
})

test('optimized NFT images preserve every source pixel', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  const result = await page.evaluate(async () => {
    const manifest = await (await fetch('/assets/nft/manifest.json')).json() as { assets: Array<{ source: string; file: string }> }
    const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = url
    })
    return Promise.all(manifest.assets.map(async ({ source, file }) => {
      const [original, optimized] = await Promise.all([load(`/assets/nft/${source}`), load(`/assets/nft/${file}`)])
      if (original.naturalWidth !== optimized.naturalWidth || original.naturalHeight !== optimized.naturalHeight) return false
      const canvas = document.createElement('canvas')
      canvas.width = original.naturalWidth
      canvas.height = original.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.drawImage(original, 0, 0)
      const expected = context.getImageData(0, 0, canvas.width, canvas.height).data
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(optimized, 0, 0)
      const actual = context.getImageData(0, 0, canvas.width, canvas.height).data
      return expected.every((value, index) => value === actual[index])
    }))
  })
  expect(result).toEqual([true, true, true, true])
})

test('as telas carregam imagens e fonte local sem serviços externos', async ({ page }) => {
  test.setTimeout(180000)
  const icons = JSON.parse(await readFile('public/assets/icons/manifest.json', 'utf8')) as { assets: Array<{ file: string }> }
  const nft = JSON.parse(await readFile('public/assets/nft/manifest.json', 'utf8')) as { assets: Array<{ source: string; file: string }> }
  const trackedImages = new Set([...icons.assets.map(({ file }) => `/assets/icons/${file}`), ...nft.assets.flatMap(({ source, file }) => [`/assets/nft/${source}`, `/assets/nft/${file}`])])
  const observedImages = new Set<string>()
  const externalRequests: string[] = []
  let checkedCssImages = 0
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(url.origin)
      await route.abort()
    } else await route.continue()
  })
  async function checkImages() {
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await expect.poll(() => page.evaluate(() => [...document.images].every((image) => image.complete && Boolean(image.currentSrc) && image.naturalWidth > 0)), { timeout: 15000 }).toBe(true)
    const result = await page.evaluate(async () => {
      const images = [...document.images]
      await Promise.all(images.map((image) => image.decode()))
      const cssUrls = new Set<string>()
      for (const element of document.querySelectorAll('*')) for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        for (const property of [style.backgroundImage, style.maskImage]) for (const match of property.matchAll(/url\(["']?([^"')]+)["']?\)/g)) cssUrls.add(new URL(match[1], location.href).href)
      }
      const cssImages = await Promise.all([...cssUrls].map(async (source) => {
        const image = new Image(); image.src = source; await image.decode()
        return { source, width: image.naturalWidth, height: image.naturalHeight }
      }))
      return {
        images: images.map((image) => ({ source: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight })),
        cssImages,
        fonts: [400, 500, 700].map((weight) => document.fonts.check(`${weight} 16px "Roboto Mono Variable"`, 'áéíóú NFT')),
      }
    })
    expect(result.images.length).toBeGreaterThan(0)
    checkedCssImages += result.cssImages.length
    for (const image of [...result.images, ...result.cssImages]) {
      const url = new URL(image.source)
      expect(url.origin).toBe('http://127.0.0.1:4173')
      expect(trackedImages.has(url.pathname), `${url.pathname} não está nos manifests`).toBe(true)
      observedImages.add(url.pathname)
      expect(image.width).toBeGreaterThan(0)
      expect(image.height).toBeGreaterThan(0)
    }
    expect(result.fonts).toEqual([true, true, true])
  }
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [route, ready] of [['/', '.home-card'], ['/nfts/emerald-ape-042', '.detail-title'], ['/cart?mockScenario=visual-mobile', '.cart-line'], ['/login', '.auth-fields'], ['/signup', '.auth-fields']]) {
      await page.goto(`http://127.0.0.1:4173${route}`)
      await expect(page.locator(ready).first()).toBeVisible()
      await checkImages()
      if (route === '/nfts/emerald-ape-042') {
        await page.getByRole('button', { name: 'Ampliar imagem' }).click()
        await expect(page.getByRole('dialog', { name: 'Imagem ampliada' })).toBeVisible()
        await checkImages()
        await page.getByRole('button', { name: 'Fechar imagem' }).click({ timeout: 5000 })
        await expect(page.getByRole('dialog', { name: 'Imagem ampliada' })).toBeHidden()
      }
      if (route === '/' && width < 1280) {
        await page.getByRole('button', { name: 'Filtros', exact: true }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await checkImages()
        await page.keyboard.press('Escape')
      }
    }
  }
  await page.goto('http://127.0.0.1:4173/login?returnTo=%2Fprofile')
  await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
  await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [route, ready] of [['/profile', '.profile-form'], ['/wallets', '.wallet-fields'], ['/checkout', '.checkout-fields'], ['/favorites', '.favorites-page']]) {
      await page.goto(`http://127.0.0.1:4173${route}`)
      await expect(page.locator(ready).first()).toBeVisible()
      await checkImages()
    }
  }
  await page.goto('http://127.0.0.1:4173/checkout')
  await expect(page.locator('.checkout-fields')).toBeVisible()
  await page.evaluate(async () => {
    const token = localStorage.getItem('kurio.session-token')!
    const wallet = { displayName: 'Colecionador', nickname: 'Principal', network: 'ethereum', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'colecionador' }
    const response = await fetch('/api/v1/wallets/primary', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'If-Match': '0' }, body: JSON.stringify(wallet) })
    if (!response.ok) throw new Error(`wallet ${response.status}`)
  })
  await page.reload()
  await page.getByLabel(/Carteira principal — Principal/).click()
  await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
  const confirm = page.getByRole('button', { name: 'Confirmar compra', exact: true })
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15000 })
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.order-item').first()).toBeVisible()
    await checkImages()
  }
  expect(checkedCssImages).toBeGreaterThan(0)
  for (const file of ['context-989807e1d00ec515.svg', 'context-434d15ce624cf881.svg', 'context-0445e8ea7de3d164.svg', 'context-96a93ad0e8b8aa42.svg', 'auth-desktop-signup-hide-figma.svg', 'auth-mobile-signup-hide-figma.svg', ...[244, 245, 249, 251, 252, 253, 254].map((node) => `google-desktop-${node}.svg`), ...['facebook', 'instagram', 'twitter', 'linkedin', 'youtube'].map((name) => `footer-${name}-figma.svg`)]) {
    expect(observedImages.has(`/assets/icons/${file}`), `${file} não foi exercitado`).toBe(true)
  }
  expect(externalRequests).toEqual([])
})
