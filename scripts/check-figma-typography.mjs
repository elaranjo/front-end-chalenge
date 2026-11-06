import { readFile, readdir } from 'node:fs/promises'

const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const directory = 'docs/figma-inspection/data'
const source = await json(`${directory}/source-nodes.json`)
const key = (guid) => guid ? `${guid.sessionID}:${guid.localID}` : ''
const nodes = new Map(source.nodes.map((node) => [key(node.guid), node]))
const files = (await readdir(directory)).filter((file) => /^frame-\d+-\d+\.json$/.test(file))
if (files.length !== 15) throw new Error(`Esperados 15 inventários de frames, recebidos ${files.length}`)
const styles = new Map()
const overrides = []
let count = 0
for (const file of files) {
  const frame = await json(`${directory}/${file}`)
  for (const text of frame.directTexts) {
    const node = nodes.get(text.id)
    if (!node || node.type !== 'TEXT') throw new Error(`${text.id}: nó de texto ausente`)
    const style = nodes.get(key(node.styleIdForText?.guid))
    const font = style?.fontName ?? node.fontName
    if (!font?.family || !font?.style) throw new Error(`${text.id}: fonte ausente`)
    const name = `${font.family}/${font.style}`
    styles.set(name, (styles.get(name) ?? 0) + 1)
    if (font.family !== 'Roboto Mono' || !['Regular', 'Medium', 'Bold'].includes(font.style)) throw new Error(`${text.id}: estilo fora dos pesos locais (${name})`)
    if (node.fontName?.family !== font.family || node.fontName?.style !== font.style) overrides.push({ nodeId: text.id, raw: node.fontName, textStyle: key(node.styleIdForText?.guid), resolved: font })
    count++
  }
}
console.log(`${count} textos diretos em 15 frames; estilos ligados ou nomes locais: ${JSON.stringify(Object.fromEntries(styles))}.`)
console.log(`${overrides.length} registros têm nome bruto diferente do estilo vinculado; as propriedades resolvidas requerem conferência.`)
const inventory = await json(`${directory}/frame-instance-coverage.json`)
if (inventory.unresolvedDefinitions.length) throw new Error('Há definições aninhadas sem resolução no inventário.')
const children = new Map()
for (const node of source.nodes) {
  const parent = key(node.parentIndex?.guid)
  if (!parent) continue
  if (!children.has(parent)) children.set(parent, [])
  children.get(parent).push(node)
}
const symbols = new Set([...inventory.instances, ...inventory.nestedInstances].map((instance) => instance.symbolId))
const componentTexts = new Map()
for (const symbolId of symbols) {
  const pending = [...(children.get(symbolId) ?? [])]
  while (pending.length) {
    const node = pending.pop()
    if (node.type === 'INSTANCE') continue
    if (node.type === 'TEXT') componentTexts.set(key(node.guid), node)
    pending.push(...(children.get(key(node.guid)) ?? []))
  }
}
const componentStyles = new Map()
for (const [nodeId, node] of componentTexts) {
  const font = nodes.get(key(node.styleIdForText?.guid))?.fontName ?? node.fontName
  if (!font || font.family !== 'Roboto Mono' || !['Regular', 'Medium', 'Bold'].includes(font.style)) throw new Error(`${nodeId}: fonte da definição não coberta pela fonte local`)
  const name = `${font.family}/${font.style}`
  componentStyles.set(name, (componentStyles.get(name) ?? 0) + 1)
}
console.log(`${componentTexts.size} textos únicos em ${symbols.size} definições alcançadas: ${JSON.stringify(Object.fromEntries(componentStyles))}.`)
let typographyOverrides = 0
for (const instance of [...inventory.instances, ...inventory.nestedInstances]) {
  const node = nodes.get(instance.instanceId)
  for (const override of [...(node?.symbolData?.symbolOverrides ?? []), ...(node?.derivedSymbolData ?? [])]) {
    if (['fontName', 'styleIdForText', 'fontSize', 'textData', 'fontWeight'].some((field) => override[field] != null)) typographyOverrides++
  }
}
console.log(`${typographyOverrides} ocorrências com campos tipográficos explícitos nos overrides/derivedSymbolData inspecionados.`)
console.log('A leitura não resolve outros mecanismos de override e não substitui a conferência de fontes computadas no navegador.')
