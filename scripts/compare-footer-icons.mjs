import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 100, height: 100 }, deviceScaleFactor: 1 })
  for (const name of ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube']) {
    const old = (await readFile(`public/assets/icons/footer-${name}.svg`)).toString('base64')
    const figma = (await readFile(`public/assets/icons/footer-${name}-figma.svg`)).toString('base64')
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#241612}.sample{width:32px;height:32px;position:relative;background:#241612}.old button{position:absolute;left:1px;top:1px;width:30px;height:30px;padding:0;border:1px solid #d28a4c;border-radius:5px;background:transparent}.old img{display:block;width:100%;height:100%}.reference img{width:32px;height:32px;display:block}</style><div class="sample old"><button><img src="data:image/svg+xml;base64,${old}"></button></div><div class="sample reference"><img src="data:image/svg+xml;base64,${figma}"></div>`)
    await page.evaluate(async () => Promise.all([...document.images].map((image) => image.decode())))
    const current = (await page.locator('.old').screenshot()).toString('base64')
    const reference = (await page.locator('.reference').screenshot()).toString('base64')
    const comparison = await page.evaluate(async ({ current, reference }) => {
      async function pixels(data) { const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, 32, 32).data }
      const [a, b] = await Promise.all([pixels(current), pixels(reference)])
      let changedPixels = 0, max = 0
      for (let i = 0; i < a.length; i += 4) { let difference = 0; for (let j = 0; j < 3; j++) difference = Math.max(difference, Math.abs(a[i + j] - b[i + j])); if (difference) changedPixels++; max = Math.max(max, difference) }
      return { changedPixels, maxChannelDifference: max }
    }, { current, reference })
    console.log(`${name}: ${JSON.stringify(comparison)}`)
  }
} finally {
  await browser.close()
}
