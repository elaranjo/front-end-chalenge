import { expect, test } from '@playwright/test'

for (const width of [390, 414]) {
  test(`contraste do resumo e detalhe é verificável em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 896 })
    await page.goto('http://127.0.0.1:5173/nfts/emerald-ape-042')
    const description = page.locator('.detail-description')
    await expect(description).toBeVisible()
    const detail = await description.evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element.closest('.detail-sheet')!).backgroundColor }))
    const contrast = (foreground: string, background: string) => {
      const luminance = (color: string) => color.match(/\d+/g)!.slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      const a = luminance(foreground); const b = luminance(background)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    expect(contrast(detail.color, detail.background)).toBeGreaterThanOrEqual(4.5)

    await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
    const button = page.getByRole('button', { name: 'Conectar e finalizar' })
    await expect(button).toBeEnabled()
    await button.scrollIntoViewIfNeeded()
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
    const data = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: getComputedStyle(element).color }
    })
    const visible = (await page.screenshot()).toString('base64')
    await page.addStyleTag({ content: '.cart-checkout { color: transparent !important; text-shadow: none !important; }' })
    const background = (await page.screenshot()).toString('base64')
    const result = await page.evaluate(async ({ visible, background, data, width }) => {
      const pixels = async (source: string) => {
        const image = new Image(); image.src = `data:image/png;base64,${source}`; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
        const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, image.width, image.height).data
      }
      const [front, back] = await Promise.all([pixels(visible), pixels(background)])
      const lum = (rgb: number[]) => rgb.map((value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      const foreground = data.color.match(/\d+/g)!.slice(0, 3).map(Number); const fg = lum(foreground); const ratios: number[] = []
      for (let y = Math.max(0, Math.floor(data.y)); y < Math.min(896, Math.ceil(data.y + data.height)); y++) for (let x = Math.max(0, Math.floor(data.x)); x < Math.min(width, Math.ceil(data.x + data.width)); x++) {
        const index = (y * width + x) * 4
        if (foreground.every((value, channel) => Math.abs(front[index + channel] - value) <= 2) && foreground.some((_, channel) => Math.abs(front[index + channel] - back[index + channel]) > 5)) {
          const bg = lum([back[index], back[index + 1], back[index + 2]])
          ratios.push((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05))
        }
      }
      return { samples: ratios.length, minimum: ratios.length ? Math.min(...ratios) : 0 }
    }, { visible, background, data, width })
    expect(result.samples).toBeGreaterThan(0)
    expect(result.minimum).toBeGreaterThanOrEqual(4.5)
  })
}
