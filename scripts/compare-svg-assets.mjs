import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const [first, second] = process.argv.slice(2)
if (!first || !second) throw new Error('Informe dois caminhos SVG para comparação.')
const sources = await Promise.all([first, second].map(async (file) => (await readFile(file)).toString('base64')))
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const result = await page.evaluate(async (sources) => {
    const images = await Promise.all(sources.map(async (source) => { const image = new Image(); image.src = `data:image/svg+xml;base64,${source}`; await image.decode(); return image }))
    const [a, b] = images
    if (a.width !== b.width || a.height !== b.height) return { dimensions: images.map(({ width, height }) => [width, height]), comparable: false }
    const canvas = document.createElement('canvas'); canvas.width = a.width; canvas.height = a.height
    const context = canvas.getContext('2d')
    context.drawImage(a, 0, 0); const expected = context.getImageData(0, 0, canvas.width, canvas.height).data
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(b, 0, 0); const actual = context.getImageData(0, 0, canvas.width, canvas.height).data
    let changedPixels = 0, maxChannelDifference = 0
    for (let i = 0; i < expected.length; i += 4) { let difference = 0; for (let channel = 0; channel < 4; channel++) difference = Math.max(difference, Math.abs(expected[i + channel] - actual[i + channel])); if (difference) changedPixels++; maxChannelDifference = Math.max(maxChannelDifference, difference) }
    return { comparable: true, width: canvas.width, height: canvas.height, changedPixels, maxChannelDifference }
  }, sources)
  console.log(JSON.stringify({ files: [first, second], ...result }))
} finally { await browser.close() }
