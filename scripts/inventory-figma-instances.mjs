import { readFile, writeFile } from 'node:fs/promises'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const source = await readJson('docs/figma-inspection/data/source-nodes.json')
const references = await readJson('docs/figma-inspection/references/manifest.json')
const icons = await readJson('public/assets/icons/manifest.json')
const key = (guid) => guid ? `${guid.sessionID}:${guid.localID}` : ''
const nodes = new Map(source.nodes.map((node) => [key(node.guid), node]))
const frames = new Map(references.frames.map((frame) => [frame.nodeId, frame.id]))
const children = new Map()
for (const node of source.nodes) {
  const parentId = key(node.parentIndex?.guid)
  if (!parentId) continue
  if (!children.has(parentId)) children.set(parentId, [])
  children.get(parentId).push(node)
}
function descendantSymbols(rootId) {
  const found = []
  const pending = [...(children.get(rootId) ?? [])]
  while (pending.length) {
    const node = pending.pop()
    if (node.type === 'INSTANCE' && node.symbolData?.symbolID) found.push(key(node.symbolData.symbolID))
    else pending.push(...(children.get(key(node.guid)) ?? []))
  }
  return found
}

const instances = []
for (const node of source.nodes) {
  if (node.type !== 'INSTANCE' || !node.symbolData?.symbolID) continue
  const ancestors = []
  let parent = nodes.get(key(node.parentIndex?.guid))
  while (parent && !frames.has(key(parent.guid))) {
    ancestors.push(key(parent.guid))
    parent = nodes.get(key(parent.parentIndex?.guid))
  }
  if (!parent) continue
  const instanceId = key(node.guid)
  const symbolId = key(node.symbolData.symbolID)
  const directIds = new Set([instanceId, symbolId, ...ancestors])
  const candidates = icons.assets.flatMap((asset) => {
    const ids = asset.nodeId.split(/\s*\/\s*/)
    if (ids.some((id) => directIds.has(id))) return [{ file: asset.file, nodeId: asset.nodeId, relation: 'direct-or-ancestor' }]
    if (ids.some((id) => key(nodes.get(id)?.symbolData?.symbolID) === symbolId)) return [{ file: asset.file, nodeId: asset.nodeId, relation: 'shared-symbol' }]
    if (ids.some((id) => { const contained = descendantSymbols(id); return contained.length > 0 && contained.length <= 5 && contained.includes(symbolId) })) return [{ file: asset.file, nodeId: asset.nodeId, relation: 'group-containing-symbol' }]
    return []
  })
  instances.push({ frame: frames.get(key(parent.guid)), instanceId, name: node.name, symbolId, symbolName: nodes.get(symbolId)?.name ?? null, candidates })
}
instances.sort((a, b) => a.frame.localeCompare(b.frame) || a.instanceId.localeCompare(b.instanceId, undefined, { numeric: true }))
const nestedInstances = []
const unresolvedDefinitions = new Set()
function expand(symbolId, origin, symbolPath) {
  if (symbolPath.includes(symbolId)) {
    unresolvedDefinitions.add(`ciclo: ${[...symbolPath, symbolId].join(' → ')}`)
    return
  }
  if (!nodes.has(symbolId)) {
    unresolvedDefinitions.add(`definição ausente: ${symbolId}`)
    return
  }
  const path = [...symbolPath, symbolId]
  const pending = [...(children.get(symbolId) ?? [])]
  while (pending.length) {
    const child = pending.pop()
    if (child.type === 'INSTANCE' && child.symbolData?.symbolID) {
      const nestedSymbol = key(child.symbolData.symbolID)
      nestedInstances.push({ frame: origin.frame, rootInstanceId: origin.instanceId, symbolPath: path, instanceId: key(child.guid), name: child.name, symbolId: nestedSymbol, symbolName: nodes.get(nestedSymbol)?.name ?? null })
      expand(nestedSymbol, origin, path)
    } else pending.push(...(children.get(key(child.guid)) ?? []))
  }
}
for (const instance of instances) expand(instance.symbolId, instance, [])
const result = {
  source: 'docs/figma-inspection/data/source-nodes.json',
  method: 'Instâncias diretamente presentes nos 15 frames e instâncias aninhadas em suas definições; candidatos diretos por ID, símbolo compartilhado ou grupo pequeno. A expansão não resolve visibilidade, overrides nem transformações propagados; candidato não comprova correspondência visual ou uso na aplicação.',
  instances,
  nestedInstances,
  unresolvedDefinitions: [...unresolvedDefinitions].sort(),
}
await writeFile('docs/figma-inspection/data/frame-instance-coverage.json', `${JSON.stringify(result, null, 2)}\n`)
const missing = instances.filter((instance) => !instance.candidates.length)
console.log(`${instances.length} instâncias diretas; ${missing.length} sem candidato pelo vínculo automático. Revisão manual é obrigatória.`)
console.log(`${nestedInstances.length} ocorrências aninhadas; ${unresolvedDefinitions.size} definições ausentes ou ciclos.`)
for (const entry of missing) console.log(`${entry.frame} ${entry.instanceId} → ${entry.symbolId} ${entry.symbolName}`)
