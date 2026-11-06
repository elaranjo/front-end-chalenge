import { expect, test } from '@playwright/test'

test('desktop header, featured and promotional text have measurable contrast over rendered backgrounds', async ({ page }) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://127.0.0.1:5173/')
  await expect(page.locator('.home-card').first()).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
  for (const selector of ['.home-logo', '.home-header nav a[aria-current]', '.home-header nav a[href$="#catalogo"]', '.home-header nav button:nth-of-type(1)', '.home-header nav button:nth-of-type(2)', '.home-login', '.home-featured h2', '.home-featured p', '.home-promo:nth-child(1) h2', '.home-promo:nth-child(1) p', '.home-promo:nth-child(1) a', '.home-promo:nth-child(2) h2', '.home-promo:nth-child(2) p', '.home-promo:nth-child(2) a']) {
    const target = page.locator(selector)
    await target.scrollIntoViewIfNeeded()
    const info = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: getComputedStyle(element).color }
    })
    const before = (await page.screenshot()).toString('base64')
    await target.evaluate((element: HTMLElement) => element.style.setProperty('color', 'transparent', 'important'))
    const after = (await page.screenshot()).toString('base64')
    await target.evaluate((element: HTMLElement) => element.style.removeProperty('color'))
    const result = await page.evaluate(async ({ before, after, info }) => {
      async function pixels(source: string) {
        const image = new Image(); image.src = `data:image/png;base64,${source}`; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
        const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(image, 0, 0)
        return { data: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height }
      }
      const front = await pixels(before); const back = await pixels(after)
      const luminance = (rgb: number[]) => rgb.map((value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      const foreground = info.color.match(/\d+/g)!.slice(0, 3).map(Number); const fg = luminance(foreground); const ratios: number[] = []
      for (let y = Math.max(0, Math.floor(info.y)); y < Math.min(front.height, Math.ceil(info.y + info.height)); y++) for (let x = Math.max(0, Math.floor(info.x)); x < Math.min(front.width, Math.ceil(info.x + info.width)); x++) {
        const i = (y * front.width + x) * 4
        if (foreground.every((value, channel) => Math.abs(front.data[i + channel] - value) <= 2) && foreground.some((_, channel) => Math.abs(front.data[i + channel] - back.data[i + channel]) > 5)) {
          const bg = luminance([back.data[i], back.data[i + 1], back.data[i + 2]])
          ratios.push((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05))
        }
      }
      return { samples: ratios.length, minimum: ratios.length ? Math.min(...ratios) : 0 }
    }, { before, after, info })
    expect(result.samples, selector).toBeGreaterThan(0)
    expect(result.minimum, selector).toBeGreaterThanOrEqual(4.5)
  }
})
