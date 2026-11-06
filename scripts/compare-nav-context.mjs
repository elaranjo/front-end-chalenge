import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const files = ['context-5e4a0cdcc3779485', 'context-88966ba04e689606', 'context-817217a0fb3c14a9', 'context-685a52bee52914a2', 'context-b139c41ef0e3cd55', 'context-fd0bba2847544e3d', 'context-6e762edf1dfd8e8f', 'context-f374805f6712c71c', 'context-225ff31a985101fd', 'context-cf24e892c1ecce9c', 'context-287fb8dff06b629a']
const images = await Promise.all(files.map(async (file) => (await readFile(`public/assets/icons/${file}.svg`)).toString('base64')))
const reference = (await readFile('docs/figma-inspection/asset-comparisons/nav-figma-component.png')).toString('base64')
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 414, height: 135 }, deviceScaleFactor: 1 })
  const img = (index) => `<img src="data:image/svg+xml;base64,${images[index]}">`
  await page.setContent(`<style>body{margin:0;background:#140d0a}.frame{position:absolute;top:9px;width:414px;height:126px}.part{position:absolute}.part img{display:block;max-width:none}.back{inset:24.6% 0 0.04% 0}.back img{position:absolute;top:-42.13%;left:-7.25%}.circle{top:0;left:175px}.home{inset:56.35% 86.47% 27.78% 8.7%}.home img{position:absolute;top:8.33%;left:10.42%}.user{inset:56.35% 9.66% 27.78% 85.51%}.shop{inset:56.35% 24.64% 27.78% 70.53%}.heart{inset:57.14% 69.08% 28.74% 26.09%}.p1{inset:25.48% 46.66% 73.1% 46.86%}.p2{inset:27.53% 50.32% 64.29% 47.18%}.p3{inset:16.73% 46.98% 75.09% 50.51%}.p4{inset:27.54% 47% 64.33% 50.51%}.p5{inset:16.67% 50.31% 75.15% 47.18%}</style><div class="frame"><div class="part back">${img(0)}</div><div class="part circle">${img(1)}</div><div class="part home">${img(2)}</div><div class="part user">${img(3)}</div><div class="part shop">${img(4)}</div><div class="part heart">${img(5)}</div>${[6,7,8,9,10].map((n) => `<div class="part p${n-5}">${img(n)}</div>`).join('')}</div>`)
  await page.evaluate(async () => Promise.all([...document.images].map((image) => image.decode())))
  const actual = (await page.screenshot()).toString('base64')
  const result = await page.evaluate(async ({ reference, actual }) => {
    async function load(data) { const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode(); return image }
    const [original, rendered] = await Promise.all([load(reference), load(actual)])
    const canvas = document.createElement('canvas'); canvas.width = 414; canvas.height = 135; const context = canvas.getContext('2d')
    context.fillStyle = '#140d0a'; context.fillRect(0, 0, 414, 135); context.drawImage(original, 0, 0)
    const expected = context.getImageData(0, 0, 414, 135).data
    context.clearRect(0, 0, 414, 135); context.drawImage(rendered, 0, 0)
    const observed = context.getImageData(0, 0, 414, 135).data
    let changedPixels = 0, aboveFive = 0, max = 0, sum = 0
    for (let i = 0; i < expected.length; i += 4) { let d = 0; for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(expected[i + c] - observed[i + c])); if (d) changedPixels++; if (d > 5) aboveFive++; max = Math.max(max, d); sum += d }
    return { changedPixels, aboveFive, meanMaxChannelDifference: sum / (414 * 135), maxChannelDifference: max }
  }, { reference, actual })
  console.log(JSON.stringify(result))
} finally { await browser.close() }
