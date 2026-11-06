import { expect, test } from '@playwright/test'

for (const width of [768, 1440]) {
  for (const view of ['home', 'cart'] as const) {
  for (const fixture of [{ scenario: 'visual-mobile', count: '6' }, { scenario: 'visual-desktop', count: '17' }, { scenario: 'default', count: '100' }]) {
    test(`cart badge ${fixture.count} contrast is measurable on ${view} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`http://127.0.0.1:5173/${view === 'cart' ? 'cart' : ''}?mockScenario=${fixture.scenario}`)
      if (fixture.count === '100') {
        await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
        await expect(page.locator(view === 'home' ? '.home-card' : '.cart-empty').first()).toBeVisible()
        await page.evaluate(async () => {
          const visitor = localStorage.getItem('kurio.visitor-id')!
          const response = await fetch('/api/v1/cart/items', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': visitor, 'If-Match': '0', 'X-Mutation-Id': crypto.randomUUID() }, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: 'open', quantity: 100 }) })
          if (!response.ok) throw new Error(`cart ${response.status}`)
        })
        await page.reload()
      }
      const badge = page.locator(view === 'home' ? '.home-header-cart > span' : '.account-cart > span')
      await expect(badge).toHaveText(fixture.count)
      await page.evaluate(() => document.fonts.ready)
      const color = await badge.evaluate((element) => getComputedStyle(element).color)
      const before = (await badge.screenshot()).toString('base64')
      await badge.evaluate((element: HTMLElement) => element.style.setProperty('color', 'transparent', 'important'))
      const after = (await badge.screenshot()).toString('base64')
      const result = await page.evaluate(async ({ before, after, color }) => {
        async function pixels(source: string) {
          const image = new Image(); image.src = `data:image/png;base64,${source}`; await image.decode()
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
          const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(image, 0, 0)
          return { data: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height }
        }
        const front = await pixels(before); const back = await pixels(after)
        const luminance = (rgb: number[]) => rgb.map((value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
        const foreground = color.match(/\d+/g)!.slice(0, 3).map(Number); const fg = luminance(foreground); const ratios: number[] = []
        if (front.width !== back.width || front.height !== back.height) throw new Error('Badge dimensions changed between captures')
        for (let y = 0; y < front.height; y++) for (let x = 0; x < front.width; x++) {
          const i = (y * front.width + x) * 4
          if (foreground.some((_, channel) => Math.abs(front.data[i + channel] - back.data[i + channel]) > 8)) {
            const bg = luminance([back.data[i], back.data[i + 1], back.data[i + 2]])
            ratios.push((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05))
          }
        }
        return { samples: ratios.length, minimum: ratios.length ? Math.min(...ratios) : 0 }
      }, { before, after, color })
      expect(result.samples).toBeGreaterThan(0)
      expect(result.minimum).toBeGreaterThanOrEqual(4.5)
    })
  }
  }
}
