import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const frame = (await readFile('docs/figma-inspection/references/F06-desktop-login.png')).toString('base64')
  for (const name of ['google', 'facebook']) {
    const reference = (await readFile(`docs/figma-inspection/asset-comparisons/${name}-desktop-source.svg`)).toString('base64')
    const asset = (await readFile(`public/assets/icons/${name}-mobile.svg`)).toString('base64')
    const result = await page.evaluate(async ({ reference, asset }) => {
      async function pixels(data) {
        const image = new Image()
        image.src = `data:image/svg+xml;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 20
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, 20, 20)
        return context.getImageData(0, 0, 20, 20).data
      }
      const [left, right] = await Promise.all([pixels(reference), pixels(asset)])
      let changedPixels = 0, totalDifference = 0, maxDifference = 0
      for (let index = 0; index < left.length; index += 4) {
        let difference = 0
        for (let channel = 0; channel < 4; channel++) difference = Math.max(difference, Math.abs(left[index + channel] - right[index + channel]))
        if (difference) changedPixels++
        totalDifference += difference
        maxDifference = Math.max(maxDifference, difference)
      }
      return { changedPixels, maxDifference, meanMaxChannelDifference: totalDifference / 400 }
    }, { reference, asset })
    console.log(`${name}: ${JSON.stringify(result)}`)
    const position = name === 'google' ? { x: 625, y: 575, offset: 0.5, width: 21 } : { x: 618, y: 627, offset: 0, width: 20 }
    const variants = [['desktop-source', reference], ['mobile', asset]]
    if (name === 'facebook') variants.push(['desktop-figma-export', (await readFile('public/assets/icons/facebook-desktop-figma.svg')).toString('base64')])
    for (const [variant, image] of variants) {
      const comparison = await page.evaluate(async ({ frame, image, position }) => {
        async function load(source) { const result = new Image(); result.src = source; await result.decode(); return result }
        const [referenceImage, svg] = await Promise.all([load(`data:image/png;base64,${frame}`), load(`data:image/svg+xml;base64,${image}`)])
        const full = document.createElement('canvas'); full.width = referenceImage.width; full.height = referenceImage.height
        const fullContext = full.getContext('2d'); fullContext.drawImage(referenceImage, 0, 0)
        const original = fullContext.getImageData(position.x, position.y, position.width, 20).data
        const background = fullContext.getImageData(position.x, position.y, 1, 1).data
        const local = document.createElement('canvas'); local.width = position.width; local.height = 20
        const context = local.getContext('2d')
        context.fillStyle = `rgb(${background[0]}, ${background[1]}, ${background[2]})`; context.fillRect(0, 0, position.width, 20)
        context.drawImage(svg, position.offset, 0, 20, 20)
        const rendered = context.getImageData(0, 0, position.width, 20).data
        let sum = 0, maximum = 0
        for (let i = 0; i < original.length; i += 4) for (let channel = 0; channel < 3; channel++) {
          const difference = Math.abs(original[i + channel] - rendered[i + channel]); sum += difference; maximum = Math.max(maximum, difference)
        }
        return { meanChannelDifference: sum / (position.width * 20 * 3), maxChannelDifference: maximum }
      }, { frame, image, position })
      console.log(`${name} ${variant} versus F06: ${JSON.stringify(comparison)}`)
    }
    const button = (await readFile(`${rootPath(name)}-button.png`)).toString('base64')
    const buttonPosition = name === 'google' ? { x: 75, y: 10, offset: 0.5, width: 21 } : { x: 68, y: 10, offset: 0, width: 20 }
    for (const [variant, image] of variants) {
      const difference = await page.evaluate(async ({ button, image, position }) => {
        async function load(source) { const result = new Image(); result.src = source; await result.decode(); return result }
        const [referenceImage, svg] = await Promise.all([load(`data:image/png;base64,${button}`), load(`data:image/svg+xml;base64,${image}`)])
        const full = document.createElement('canvas'); full.width = referenceImage.width; full.height = referenceImage.height
        const fullContext = full.getContext('2d'); fullContext.drawImage(referenceImage, 0, 0)
        const original = fullContext.getImageData(position.x, position.y, position.width, 20).data
        const background = fullContext.getImageData(position.x, position.y, 1, 1).data
        const local = document.createElement('canvas'); local.width = position.width; local.height = 20
        const context = local.getContext('2d'); context.fillStyle = `rgb(${background[0]}, ${background[1]}, ${background[2]})`; context.fillRect(0, 0, position.width, 20)
        context.drawImage(svg, position.offset, 0, 20, 20)
        const rendered = context.getImageData(0, 0, position.width, 20).data
        let sum = 0, maximum = 0
        for (let i = 0; i < original.length; i += 4) for (let channel = 0; channel < 3; channel++) {
          const delta = Math.abs(original[i + channel] - rendered[i + channel]); sum += delta; maximum = Math.max(maximum, delta)
        }
        return { meanChannelDifference: sum / (position.width * 20 * 3), maxChannelDifference: maximum }
      }, { button, image, position: buttonPosition })
      console.log(`${name} ${variant} versus botão Figma: ${JSON.stringify(difference)}`)
    }
  }
} finally {
  await browser.close()
}

function rootPath(name) { return `docs/figma-inspection/asset-comparisons/figma-export/${name}` }
