import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'

const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex')
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const failures = []
const verify = (condition, message) => { if (!condition) failures.push(message) }
const snapshot = await readFile('docs/figma-inspection/source/frontend-challenge.fig')
verify(digest('sha256', snapshot) === '7017e04fa195974ae22a27c78dc88413eb5292a849bf4defbe295062813e0dbd', 'O hash do snapshot .fig não corresponde à fonte preservada.')

const references = await readJson('docs/figma-inspection/references/manifest.json')
verify(references.frames.length === 15 && new Set(references.frames.map(({ id }) => id)).size === 15, 'O manifest deve conter 15 frames distintos.')
const frameProperties = await readJson('docs/figma-inspection/data/frames.json')
const expectedFrameNodes = ['2:2', '10:244', '11:1278', '11:2862', '11:4385', '9:115', '9:1022', '9:1238', '9:1670', '14:5226', '15:5536', '16:360', '16:748', '16:1022', '16:1228']
verify(new Set(references.frames.map(({ nodeId }) => nodeId)).size === 15, 'As referências devem apontar para 15 nós distintos.')
for (const frame of references.frames) {
  const bytes = await readFile(join('docs/figma-inspection/references', frame.file))
  verify(digest('sha256', bytes) === frame.sha256, `${frame.id}: hash diferente do manifest.`)
  const png = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  verify(png && bytes.readUInt32BE(16) === frame.width && bytes.readUInt32BE(20) === frame.height, `${frame.id}: dimensões PNG diferentes do manifest.`)
  const node = frameProperties.find(({ id }) => id === frame.nodeId)
  verify(Boolean(node) && Math.round(node.width) === frame.width && Math.round(node.height) === frame.height, `${frame.id}: nó ou dimensões não correspondem ao inventário de propriedades.`)
  const number = /^F(\d{2})$/.exec(frame.id)
  verify(Boolean(number) && expectedFrameNodes[Number(number?.[1]) - 1] === frame.nodeId, `${frame.id}: vínculo de nó diverge da matriz visual.`)
}

// Capturas de referência são evidência, nunca assets de apresentação da aplicação.
async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]))).flat()
}
const referenceHashes = new Set(references.frames.map(({ sha256 }) => sha256))
for (const file of await filesUnder('public')) {
  const bytes = await readFile(file)
  verify(!referenceHashes.has(digest('sha256', bytes)), `${file}: captura de frame encontrada entre os assets públicos.`)
}
const contextCatalog = await readJson('docs/figma-inspection/data/context-svg-catalog.json')
const contextKeys = contextCatalog.entries.map(({ frame, variable }) => `${frame}/${variable}`)
verify(contextCatalog.entries.length === 256 && new Set(contextKeys).size === contextCatalog.entries.length, 'O catálogo deve registrar as 256 referências SVG dos contextos sem duplicatas por frame e variável.')
const contextCoverage = await readJson('docs/figma-inspection/data/design-context-coverage.json')
const expectedContextKeys = contextCoverage.frames.flatMap(({ frame, referencedSvgConstants }) => referencedSvgConstants.map((variable) => `${frame}/${variable}`))
verify(expectedContextKeys.length === contextKeys.length && expectedContextKeys.every((key) => contextKeys.includes(key)), 'O catálogo não corresponde às constantes SVG registradas nos contextos.')
for (const entry of contextCatalog.entries) {
  const bytes = await readFile(entry.file)
  verify(digest('sha256', bytes) === entry.sha256, `${entry.frame}/${entry.variable}: hash do SVG do contexto divergente.`)
  verify(!entry.hasEmbeddedImage && !/<image\b|data:image/i.test(bytes.toString('utf8')), `${entry.frame}/${entry.variable}: SVG contém imagem embutida.`)
}
const rasterCatalog = await readJson('docs/figma-inspection/data/context-raster-catalog.json')
const rasterKeys = rasterCatalog.entries.map(({ frame, variable }) => `${frame}/${variable}`)
const expectedRasterKeys = contextCoverage.frames.flatMap(({ frame, referencedRasterConstants }) => referencedRasterConstants.map((variable) => `${frame}/${variable}`))
verify(rasterKeys.length === 35 && new Set(rasterKeys).size === rasterKeys.length && expectedRasterKeys.length === rasterKeys.length && expectedRasterKeys.every((key) => rasterKeys.includes(key)), 'O catálogo raster não corresponde às 35 constantes dos contextos.')
for (const entry of rasterCatalog.entries) verify(digest('sha256', await readFile(entry.file)) === entry.sha256, `${entry.frame}/${entry.variable}: hash da imagem raster divergente.`)

const icons = await readJson('public/assets/icons/manifest.json')
const names = icons.assets.map(({ file }) => file)
verify(new Set(names).size === names.length, 'O manifest de ícones contém arquivos duplicados.')
for (const asset of icons.assets) {
  const bytes = await readFile(join('public/assets/icons', asset.file))
  verify(digest('sha256', bytes) === asset.sha256, `${asset.file}: hash diferente do manifest.`)
  verify(Boolean(asset.nodeId && asset.detail), `${asset.file}: origem ou descrição ausente.`)
}
const diskIcons = (await readdir('public/assets/icons')).filter((file) => file.endsWith('.svg'))
for (const file of diskIcons) verify(names.includes(file), `${file}: SVG sem registro no manifest.`)

const imageFiles = (await readdir('public/assets/nft')).filter((file) => file.endsWith('.png'))
verify(imageFiles.length === 4, `Esperadas quatro imagens NFT, encontradas ${imageFiles.length}.`)
for (const file of imageFiles) {
  const bytes = await readFile(join('public/assets/nft', file))
  verify(digest('sha1', bytes) === basename(file, '.png'), `${file}: conteúdo não corresponde ao hash do nome.`)
}
const optimized = await readJson('public/assets/nft/manifest.json')
verify(optimized.assets.length === imageFiles.length, 'O manifest de imagens otimizadas não cobre todos os PNGs.')
verify(new Set(optimized.assets.map((asset) => asset.source)).size === optimized.assets.length, 'O manifest de imagens contém origens duplicadas.')
const sourceNodes = (await readJson('docs/figma-inspection/data/source-nodes.json')).nodes
const guid = (value) => value ? `${value.sessionID}:${value.localID}` : ''
const sourceGuids = new Set(sourceNodes.map((node) => guid(node.guid)))
const overrideGuids = new Set()
for (const node of sourceNodes) {
  if (node.overrideKey) overrideGuids.add(guid(node.overrideKey))
  for (const override of node.symbolData?.symbolOverrides ?? []) for (const part of override.guidPath?.guids ?? []) overrideGuids.add(guid(part))
}
for (const entry of contextCatalog.entries) {
  const parts = (entry.nodeCandidate ?? '').replace(/^I/, '').split(';').filter(Boolean)
  verify(parts.length > 0 && parts.every((part) => sourceGuids.has(part) || overrideGuids.has(part)), `${entry.frame}/${entry.variable}: ID candidato não encontrado nos nós ou chaves de override.`)
}
const sourceImageNodes = new Map()
for (const node of sourceNodes) {
  for (const paint of node.fillPaints ?? []) {
    if (paint.type !== 'IMAGE' || !paint.image?.hash) continue
    const hash = Buffer.from(Object.values(paint.image.hash)).toString('hex')
    const entries = sourceImageNodes.get(hash) ?? []
    entries.push({ nodeId: `${node.guid.sessionID}:${node.guid.localID}`, name: node.name, size: node.size, scaleMode: paint.imageScaleMode, transform: paint.transform })
    sourceImageNodes.set(hash, entries)
  }
}
for (const hash of sourceImageNodes.keys()) verify(imageFiles.includes(`${hash}.png`), `${hash}: imagem referenciada na fonte sem PNG local.`)
for (const asset of optimized.assets) {
  const original = await readFile(join('public/assets/nft', asset.source))
  const derived = await readFile(join('public/assets/nft', asset.file))
  verify(imageFiles.includes(asset.source) && digest('sha256', original) === asset.sourceSha256, `${asset.source}: origem divergente no manifest de derivados.`)
  verify(original.length === asset.originalBytes && original.readUInt32BE(16) === asset.dimensions?.[0] && original.readUInt32BE(20) === asset.dimensions?.[1], `${asset.source}: tamanho ou dimensões divergentes.`)
  const expected = sourceImageNodes.get(basename(asset.source, '.png')) ?? []
  const recorded = asset.sourceNodes ?? []
  verify(expected.length > 0 && recorded.length === expected.length && new Set(recorded.map(({ nodeId }) => nodeId)).size === recorded.length, `${asset.source}: inventário de nós incompleto ou duplicado.`)
  for (const node of expected) {
    const saved = recorded.find(({ nodeId }) => nodeId === node.nodeId)
    verify(Boolean(saved) && saved.name === node.name && JSON.stringify(saved.size) === JSON.stringify(node.size) && saved.scaleMode === node.scaleMode && JSON.stringify(saved.transform) === JSON.stringify(node.transform), `${asset.source}: propriedades divergentes no nó ${node.nodeId}.`)
  }
  verify(digest('sha256', derived) === asset.sha256 && derived.length === asset.optimizedBytes, `${asset.file}: derivado divergente no manifest.`)
}
// Valida caminhos literais presentes no código; templates dinâmicos exigem
// cobertura adicional em tempo de execução e não são inferidos por esta busca.
const trackedPaths = new Set([
  ...names.map((file) => `/assets/icons/${file}`),
  ...optimized.assets.flatMap((asset) => [`/assets/nft/${asset.source}`, `/assets/nft/${asset.file}`]),
])
const literalPaths = new Set()
for (const file of await filesUnder('src')) {
  if (!/\.(?:css|ts|tsx)$/.test(file)) continue
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(/\/assets\/(?:icons|nft)\/[A-Za-z0-9._-]+\.(?:svg|png|webp)/g)) {
    literalPaths.add(match[0])
    verify(trackedPaths.has(match[0]), `${file}: asset literal ${match[0]} sem registro no manifest.`)
  }
}
const fonts = await readJson('docs/figma-inspection/data/font-integrity.json')
const fontPackage = await readJson('node_modules/@fontsource-variable/roboto-mono/package.json')
verify(fontPackage.version === fonts.packageVersion && fontPackage.license === fonts.license.type, 'Pacote ou licença da fonte diverge do inventário.')
const fontLicense = await readFile('node_modules/@fontsource-variable/roboto-mono/LICENSE')
verify(digest('sha256', fontLicense) === fonts.licenseFileSha256, 'Licença da fonte diverge do inventário.')
const distributedFontLicense = await readFile(fonts.distributedLicensePath)
verify(digest('sha256', distributedFontLicense) === fonts.licenseFileSha256, 'Licença distribuída da fonte diverge do inventário.')
for (const font of fonts.files) {
  const bytes = await readFile(font.path)
  verify(digest('sha256', bytes) === font.sha256, `${font.path}: fonte divergente do inventário.`)
}
if (failures.length) {
  for (const failure of failures) console.error(failure)
  process.exitCode = 1
} else {
  console.log(`Integridade local verificada: snapshot .fig, ${references.frames.length} referências, ${icons.assets.length} SVGs públicos, ${contextCatalog.entries.length} vínculos SVG e ${rasterCatalog.entries.length} vínculos raster dos contextos, ${imageFiles.length} imagens NFT, ${[...sourceImageNodes.values()].reduce((count, nodes) => count + nodes.length, 0)} vínculos de imagem, ${optimized.assets.length} derivados e ${fonts.files.length} arquivos de fonte.`)
  console.log(`${literalPaths.size} caminhos literais de imagem em src correspondem aos manifests; referências dinâmicas não são cobertas por esta busca.`)
  console.log('A integridade não comprova extração completa nem aprovação da fidelidade visual.')
}
