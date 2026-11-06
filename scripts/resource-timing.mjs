import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// Supplement to Lighthouse: encodedBodySize survives MSW's response even
// when transferSize is reported as zero. This is not a network-speed test.
const base = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4173'
const pages = [['inicio', '/', '.home-card-image img'], ['detalhe', '/nfts/emerald-ape-042', '.detail-image-button > img']]
const profiles = [['mobile', 390, 844], ['desktop', 1440, 900]]
const browser = await chromium.launch()
const results = []
try {
  for (const [page, route, selector] of pages) {
    for (const [profile, width, height] of profiles) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'allow' })
      try {
        const tab = await context.newPage()
        await tab.goto(new URL(route, base).href, { waitUntil: 'load' })
        await tab.locator(selector).first().waitFor({ state: 'visible' })
        await tab.evaluate(async () => {
          await document.fonts.ready
          await Promise.all([...document.images].map((image) => image.decode().catch(() => {})))
        })
        const data = await tab.evaluate(() => ({
          serviceWorkerControlled: Boolean(navigator.serviceWorker.controller),
          images: performance.getEntriesByType('resource')
            .filter((entry) => new URL(entry.name).pathname.startsWith('/assets/nft/'))
            .map((entry) => ({ path: new URL(entry.name).pathname, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize, workerStart: entry.workerStart, durationMs: entry.duration })),
        }))
        if (!data.serviceWorkerControlled || !data.images.length || data.images.some((image) => !image.encodedBodySize)) {
          throw new Error(`Resource Timing incompleto ou mock inativo: ${page}/${profile}`)
        }
        results.push({ page, profile, viewport: { width, height }, ...data })
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}
const report = { collectedAt: new Date().toISOString(), base, browser: chromium.executablePath(), throttled: false, note: 'Tamanhos codificados observados em perfis limpos com Service Worker ativo. transferSize zero não significa ausência de transferência; duração local sem limitação de rede não representa produção.', results }
await writeFile('reports/lighthouse/resource-timing.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ collectedAt: report.collectedAt, results: results.map(({ page, profile, images }) => ({ page, profile, images: images.length, encodedBytes: images.reduce((total, image) => total + image.encodedBodySize, 0), allTransfersZero: images.every((image) => image.transferSize === 0) })) }, null, 2))
