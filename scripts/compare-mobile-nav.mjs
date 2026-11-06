import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const reference = await readFile('docs/figma-inspection/references/F10-mobile-inicio.png')
const capture = await readFile('tmp/home-mobile.png')
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const result = await page.evaluate(async ({ reference, capture }) => {
    async function load(data) { const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode(); return image }
    const [original, actual] = await Promise.all([load(reference), load(capture)])
    if (original.width !== 414 || original.height !== 896 || actual.width !== 414 || actual.height !== 896) throw new Error('As imagens devem ter 414 × 896 px')
    const canvas = document.createElement('canvas'); canvas.width = 414; canvas.height = 126
    const context = canvas.getContext('2d')
    context.drawImage(original, 0, 770, 414, 126, 0, 0, 414, 126)
    const expected = context.getImageData(0, 0, 414, 126).data
    context.clearRect(0, 0, 414, 126)
    context.drawImage(actual, 0, 770, 414, 126, 0, 0, 414, 126)
    const rendered = context.getImageData(0, 0, 414, 126).data
    let changedPixels = 0, maxChannelDifference = 0
    for (let i = 0; i < expected.length; i += 4) {
      let difference = 0
      for (let channel = 0; channel < 4; channel++) difference = Math.max(difference, Math.abs(expected[i + channel] - rendered[i + channel]))
      if (difference) changedPixels++
      maxChannelDifference = Math.max(maxChannelDifference, difference)
    }
    return { changedPixels, totalPixels: 414 * 126, maxChannelDifference }
  }, { reference: reference.toString('base64'), capture: capture.toString('base64') })
  console.log(JSON.stringify(result))
} finally {
  await browser.close()
}
