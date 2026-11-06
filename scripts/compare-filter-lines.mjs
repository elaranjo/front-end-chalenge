import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 200, height: 30 }, deviceScaleFactor: 1 })
  for (const [name, width] of [['selected', 161], ['rest', 55]]) {
    const svg = (await readFile(`public/assets/icons/filter-slider-line-${name}.svg`)).toString('base64')
    await page.setContent(`<style>body{margin:0;background:#241612}.line{width:${width}px;height:4px}.css{border-radius:2px;background:#d28a4c}.reference img{display:block}</style><div class="line css"></div><div class="line reference"><img src="data:image/svg+xml;base64,${svg}"></div>`)
    await page.locator('img').evaluate((image) => image.decode())
    const current = (await page.locator('.css').screenshot()).toString('base64')
    const reference = (await page.locator('.reference').screenshot()).toString('base64')
    const result = await page.evaluate(async ({ current, reference, width }) => {
      async function pixels(data) { const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 4; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, width, 4).data }
      const [a, b] = await Promise.all([pixels(current), pixels(reference)])
      let changed = 0
      let max = 0
      for (let i = 0; i < a.length; i += 4) { let difference = 0; for (let channel = 0; channel < 4; channel++) difference = Math.max(difference, Math.abs(a[i + channel] - b[i + channel])); if (difference) changed++; max = Math.max(max, difference) }
      return { changedPixels: changed, maxChannelDifference: max }
    }, { current, reference, width })
    console.log(`${name} (${width} × 4): ${JSON.stringify(result)}`)
  }
} finally {
  await browser.close()
}
