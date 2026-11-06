import { expect, test } from '@playwright/test'

for (const width of [320, 390, 414]) {
  test(`texto do hero mantém contraste sobre o gradiente em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 896 })
    await page.goto('http://127.0.0.1:5173/')
    await expect(page.locator('.home-card').first()).toBeVisible()
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())) })
    const geometry = await page.evaluate(() => {
      const copy = document.querySelector('.home-hero-copy')!.getBoundingClientRect()
      const art = document.querySelector('.home-hero-art')!.getBoundingClientRect()
      const hero = document.querySelector('.home-hero')!.getBoundingClientRect()
      const action = document.querySelector('.home-hero-copy > a')!.getBoundingClientRect()
      return { copyRight: copy.right, artLeft: art.left, actionBottom: action.bottom, heroBottom: hero.bottom }
    })
    expect(geometry.copyRight).toBeLessThanOrEqual(geometry.artLeft)
    expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.heroBottom)
    const selectors = ['.home-hero-copy > p:first-child', '.home-hero h1 .home-mobile-title', '.home-hero-description .home-mobile-title', '.home-hero-copy > a']
    const elements = await Promise.all(selectors.map(async (selector) => page.locator(selector).evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, color: getComputedStyle(element).color }
    })))
    const visible = (await page.screenshot()).toString('base64')
    await page.addStyleTag({ content: '.home-hero-copy, .home-hero-copy * { color: transparent !important; text-shadow: none !important; }' })
    const background = (await page.screenshot()).toString('base64')
    const results = await page.evaluate(async ({ visible, background, elements, width }) => {
      const pixels = async (data: string) => {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width; canvas.height = image.height
        const context = canvas.getContext('2d', { willReadFrequently: true })!
        context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, image.width, image.height).data
      }
      const [withText, withoutText] = await Promise.all([pixels(visible), pixels(background)])
      const luminance = (rgb: number[]) => rgb.map((value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      return elements.map(({ rect, color }) => {
        const foreground = color.match(/\d+/g)!.slice(0, 3).map(Number)
        const fg = luminance(foreground)
        const ratios: number[] = []
        for (let y = Math.max(0, Math.floor(rect.y)); y < Math.min(896, Math.ceil(rect.y + rect.height)); y++) {
          for (let x = Math.max(0, Math.floor(rect.x)); x < Math.min(width, Math.ceil(rect.x + rect.width)); x++) {
            const index = (y * width + x) * 4
            if (foreground.every((value, channel) => Math.abs(withText[index + channel] - value) <= 2) && foreground.some((_, channel) => Math.abs(withText[index + channel] - withoutText[index + channel]) > 5)) {
              const bg = luminance([withoutText[index], withoutText[index + 1], withoutText[index + 2]])
              ratios.push((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05))
            }
          }
        }
        return { samples: ratios.length, minimum: ratios.length ? Math.min(...ratios) : 0 }
      })
    }, { visible, background, elements, width })
    for (const result of results) {
      expect(result.samples).toBeGreaterThan(0)
      expect(result.minimum).toBeGreaterThanOrEqual(4.5)
    }
  })
}
