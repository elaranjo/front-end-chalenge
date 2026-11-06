import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const reference = await readFile('docs/figma-inspection/asset-comparisons/nav-figma-component.png')
const asset = await readFile('public/assets/icons/home-tab-bar.svg')
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const result = await page.evaluate(async ({ reference, asset }) => {
    async function load(type, data) { const image = new Image(); image.src = `data:${type};base64,${data}`; await image.decode(); return image }
    const [original, rendered] = await Promise.all([load('image/png', reference), load('image/svg+xml', asset)])
    if ([original, rendered].some((image) => image.width !== 414 || image.height !== 135)) throw new Error('As imagens devem ter 414 × 135 px')
    const canvas = document.createElement('canvas'); canvas.width = 414; canvas.height = 135
    const context = canvas.getContext('2d')
    context.fillStyle = '#140d0a'; context.fillRect(0, 0, 414, 135)
    context.drawImage(original, 0, 0)
    const expected = context.getImageData(0, 0, 414, 135).data
    context.fillStyle = '#140d0a'; context.fillRect(0, 0, 414, 135)
    context.drawImage(rendered, 0, 0)
    const actual = context.getImageData(0, 0, 414, 135).data
    let changedPixels = 0, aboveFive = 0, maxChannelDifference = 0, sum = 0
    for (let i = 0; i < expected.length; i += 4) {
      let difference = 0
      for (let channel = 0; channel < 4; channel++) difference = Math.max(difference, Math.abs(expected[i + channel] - actual[i + channel]))
      if (difference) changedPixels++
      if (difference > 5) aboveFive++
      sum += difference
      maxChannelDifference = Math.max(maxChannelDifference, difference)
    }
    return { changedPixels, aboveFive, totalPixels: 414 * 135, meanMaxChannelDifference: sum / (414 * 135), maxChannelDifference }
  }, { reference: reference.toString('base64'), asset: asset.toString('base64') })
  console.log(JSON.stringify(result))
} finally {
  await browser.close()
}
