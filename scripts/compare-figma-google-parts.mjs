import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const root = 'docs/figma-inspection/asset-comparisons'
const source = await readFile(`${root}/google-desktop-source.svg`, 'utf8')
const mappings = [
  { nodeId: '70483:244', file: 'figma-social-0-4.svg' },
  { nodeId: '70483:245', file: 'figma-social-0-1.svg' },
  { nodeId: '70483:250', file: 'figma-social-0-2.svg' },
  { nodeId: '70483:251', file: 'figma-social-0-3.svg' },
  { nodeId: '70483:252', file: 'figma-social-0-6.svg' },
  { nodeId: '70483:253', file: 'figma-social-0-5.svg' },
  { nodeId: '70483:254', file: 'figma-social-0-7.svg' },
]
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const [index, entry] of mappings.entries()) {
    const exported = await readFile(`${root}/figma-export/${entry.file}`, 'utf8')
    const comparison = await page.evaluate(async ({ source, exported, index }) => {
      const parser = new DOMParser()
      const reference = parser.parseFromString(source, 'image/svg+xml').querySelectorAll('path')[index]
      const exportSvg = parser.parseFromString(exported, 'image/svg+xml').documentElement
      const width = Number(exportSvg.getAttribute('width')), height = Number(exportSvg.getAttribute('height'))
      const reconstructed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="${reference.getAttribute('fill')}" d="${reference.getAttribute('d')}"/></svg>`
      async function pixels(svg) {
        const image = new Image(); image.src = `data:image/svg+xml;base64,${btoa(svg)}`; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width * 4); canvas.height = Math.ceil(height * 4)
        const context = canvas.getContext('2d'); context.scale(4, 4); context.drawImage(image, 0, 0, width, height)
        return context.getImageData(0, 0, canvas.width, canvas.height).data
      }
      const [a, b] = await Promise.all([pixels(reconstructed), pixels(exported)])
      let changed = 0, max = 0
      for (let i = 0; i < a.length; i += 4) {
        let difference = 0
        for (let j = 0; j < 4; j++) difference = Math.max(difference, Math.abs(a[i + j] - b[i + j]))
        if (difference) changed++
        max = Math.max(max, difference)
      }
      return { width, height, changedPixels: changed, maxChannelDifference: max }
    }, { source, exported, index })
    console.log(`${entry.nodeId} ${entry.file}: ${JSON.stringify(comparison)}`)
  }
} finally {
  await browser.close()
}
