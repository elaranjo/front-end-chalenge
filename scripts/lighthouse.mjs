import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const base = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4173'
const outputDir = path.resolve('reports/lighthouse')
const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
const pages = [['inicio', '/'], ['detalhe', '/nfts/emerald-ape-042']]
const results = []
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

await fs.mkdir(outputDir, { recursive: true })
const response = await fetch(base)
if (!response.ok) throw new Error(`Preview indisponível: HTTP ${response.status}`)

for (const [pageName, route] of pages) {
  for (const profile of ['mobile', 'desktop']) {
    for (let iteration = 1; iteration <= 3; iteration++) {
      const name = `${pageName}-${profile}-${iteration}`
      console.log(`Medindo ${name}`)
      // A new temporary Chrome profile for each run starts with an empty IndexedDB,
      // local storage, cache and Service Worker, so mocks initialize normally.
      const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check'] })
      try {
        const audit = await lighthouse(new URL(route, base).href, {
          port: chrome.port,
          output: ['html', 'json'],
          logLevel: 'error',
        }, profile === 'desktop' ? desktopConfig : undefined)
        if (!audit) throw new Error(`Lighthouse não retornou resultado: ${name}`)
        await fs.writeFile(path.join(outputDir, `${name}.html`), audit.report[0])
        await fs.writeFile(path.join(outputDir, `${name}.json`), audit.report[1])
        const { lhr } = audit
        results.push({
          name, page: pageName, profile, fetchTime: lhr.fetchTime,
          scores: Object.fromEntries(Object.entries(lhr.categories).map(([key, value]) => [key, value.score === null ? null : value.score * 100])),
          lcpMs: lhr.audits['largest-contentful-paint']?.numericValue ?? null,
          cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
          tbtMs: lhr.audits['total-blocking-time']?.numericValue ?? null,
          runtimeError: lhr.runtimeError ?? null,
          warnings: lhr.runWarnings,
          configSettings: lhr.configSettings,
        })
      } finally {
        await chrome.kill()
      }
    }
  }
}

const metrics = ['performance', 'accessibility', 'best-practices', 'seo']
const groups = pages.flatMap(([page]) => ['mobile', 'desktop'].map((profile) => {
  const runs = results.filter((result) => result.page === page && result.profile === profile)
  const nonNullMedian = (values) => values.every((value) => typeof value === 'number') ? median(values) : null
  return { page, profile, scores: Object.fromEntries(metrics.map((metric) => [metric, nonNullMedian(runs.map((run) => run.scores[metric]))])), lcpMs: nonNullMedian(runs.map((run) => run.lcpMs)), cls: nonNullMedian(runs.map((run) => run.cls)), tbtMs: nonNullMedian(runs.map((run) => run.tbtMs)) }
}))
const metadata = { base, node: process.version, chrome: execFileSync(chromePath, ['--version'], { encoding: 'utf8' }).trim(), lighthouse: JSON.parse(await fs.readFile('node_modules/lighthouse/package.json', 'utf8')).version, platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus()[0]?.model, logicalCpus: os.cpus().length, completedAt: new Date().toISOString(), isolatedProfiles: true }
await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify({ metadata, groups, results }, null, 2) + '\n')
console.log(JSON.stringify({ metadata, groups }, null, 2))
