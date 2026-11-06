import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const files = ['docs/figma-inspection/asset-comparisons/header-home-figma.png', 'tmp/header-home-six-items.png']
const data = await Promise.all(files.map(async (file) => (await readFile(file)).toString('base64')))
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const result = await page.evaluate(async (sources) => {
    const images = await Promise.all(sources.map(async (source) => { const image = new Image(); image.src = `data:image/png;base64,${source}`; await image.decode(); return image }))
    if (images.some((image) => image.width !== 1200 || image.height !== 45)) throw new Error('As imagens devem ter 1200 × 45 px')
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 45
    const context = canvas.getContext('2d')
    const pixels = images.map((image) => { context.fillStyle = '#140d0a'; context.fillRect(0, 0, 1200, 45); context.drawImage(image, 0, 0); return context.getImageData(0, 0, 1200, 45).data })
    const regions = { logo: [0, 160], navigation: [160, 900], actions: [900, 1200] }
    return Object.fromEntries(Object.entries(regions).map(([name, [left, right]]) => {
      let changedPixels = 0, aboveFive = 0, maximum = 0
      const bands = { textAndControls: 0, emptyMiddle: 0, underlineAndDivider: 0 }
      for (let y = 0; y < 45; y++) for (let x = left; x < right; x++) {
        const offset = (y * 1200 + x) * 4
        let difference = 0
        for (let channel = 0; channel < 4; channel++) difference = Math.max(difference, Math.abs(pixels[0][offset + channel] - pixels[1][offset + channel]))
        if (difference) changedPixels++
        if (difference > 5) {
          aboveFive++
          bands[y < 24 ? 'textAndControls' : y < 40 ? 'emptyMiddle' : 'underlineAndDivider']++
        }
        maximum = Math.max(maximum, difference)
      }
      return [name, { changedPixels, aboveFive, totalPixels: (right - left) * 45, maxChannelDifference: maximum, aboveFiveByBand: bands }]
    }))
  }, data)
  console.log(JSON.stringify(result))
} finally { await browser.close() }
