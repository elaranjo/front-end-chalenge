import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const files = {
  F06: 'context-989807e1d00ec515.svg',
  F07: 'context-434d15ce624cf881.svg',
  F14: 'context-0445e8ea7de3d164.svg',
  F15: 'context-96a93ad0e8b8aa42.svg',
}
const sources = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([frame, file]) => [frame, (await readFile(`public/assets/icons/${file}`)).toString('base64')])))
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const results = await page.evaluate(async (sources) => {
    async function pixels(source) {
      const image = new Image(); image.src = `data:image/svg+xml;base64,${source}`; await image.decode()
      if (image.width !== 20 || image.height !== 20) throw new Error('A exportação deve ter 20 × 20 px')
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, 20, 20).data
    }
    const entries = await Promise.all(Object.entries(sources).map(async ([frame, source]) => [frame, await pixels(source)]))
    const [baseline, ...others] = entries
    return Object.fromEntries(others.map(([frame, data]) => {
      let changedPixels = 0, maxChannelDifference = 0
      for (let i = 0; i < data.length; i += 4) {
        let difference = 0
        for (let channel = 0; channel < 4; channel++) difference = Math.max(difference, Math.abs(data[i + channel] - baseline[1][i + channel]))
        if (difference) changedPixels++
        maxChannelDifference = Math.max(maxChannelDifference, difference)
      }
      return [frame, { changedPixels, maxChannelDifference }]
    }))
  }, sources)
  console.log(JSON.stringify({ baseline: 'F06', background: 'transparent', results }))
} finally { await browser.close() }
