import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { inflateRawSync, zstdDecompressSync } from 'node:zlib'
import kiwi from 'kiwi-schema'

const canvas = execFileSync('unzip', ['-p', 'docs/figma-inspection/source/frontend-challenge.fig', 'canvas.fig'], { maxBuffer: 20 * 1024 * 1024 })
let offset = 12
const schemaLength = canvas.readUInt32LE(offset); offset += 4
const schema = kiwi.decodeBinarySchema(inflateRawSync(canvas.subarray(offset, offset + schemaLength))); offset += schemaLength
const messageLength = canvas.readUInt32LE(offset); offset += 4
const decoded = kiwi.compileSchema(schema).decodeMessage(zstdDecompressSync(canvas.subarray(offset, offset + messageLength)))
const id = (guid) => `${guid.sessionID}:${guid.localID}`
const nodes = new Map(decoded.nodeChanges.map((node) => [id(node.guid), node]))

function decodePath(blobId) {
  const bytes = Buffer.from(Object.values(decoded.blobs[blobId].bytes))
  let index = 0
  const parts = []
  while (index < bytes.length) {
    const opcode = bytes[index++]
    if (opcode === 0) { parts.push('Z'); continue }
    const commands = { 1: ['M', 2], 2: ['L', 2], 3: ['Q', 4], 4: ['C', 6] }
    const command = commands[opcode]
    if (!command) throw new Error(`Comando vetorial desconhecido: ${opcode}`)
    const values = []
    for (let i = 0; i < command[1]; i++) {
      values.push(Number(bytes.readFloatLE(index).toFixed(7)).toString())
      index += 4
    }
    parts.push(command[0] + values.join(' '))
  }
  return parts.join(' ')
}

for (const [file, paths, transforms, instanceId, variableId] of [
  ['arrow-right-figma.svg', ['5:102', '5:103'], ['5:101', '5:102', '5:103'], '15:5295', '70306:312'],
  ['arrow-right-2-figma.svg', ['4:395'], ['4:394'], '4:392', '70306:309'],
  ['arrow-down-2-figma.svg', ['4:151'], ['4:150'], '4:152', '70306:309'],
]) {
  const svg = await readFile(`public/assets/icons/${file}`, 'utf8')
  for (const path of paths) {
    const geometry = nodes.get(path)?.strokeGeometry
    if (!geometry?.length) throw new Error(`${path}: geometria de stroke ausente`)
    for (const part of geometry) if (!svg.includes(`d="${decodePath(part.commandsBlob)}"`)) throw new Error(`${file}: geometria ${path} diverge do snapshot`)
  }
  const svgTransforms = [...svg.matchAll(/transform="(matrix|translate)\(([^)]+)\)"/g)].map((match) => {
    const values = match[2].trim().split(/[\s,]+/).map(Number)
    return match[1] === 'translate' ? [1, 0, 0, 1, values[0], values[1] ?? 0] : values
  })
  for (const nodeId of transforms) {
    const t = nodes.get(nodeId)?.transform
    if (!t) throw new Error(`${nodeId}: transformação ausente`)
    const expected = [t.m00, t.m10, t.m01, t.m11, t.m02, t.m12]
    if (!svgTransforms.some((actual) => actual.length === 6 && actual.every((value, index) => Math.abs(value - expected[index]) < 1e-9))) throw new Error(`${file}: transformação ${nodeId} divergente`)
  }
  const overrides = nodes.get(instanceId)?.symbolData?.symbolOverrides ?? []
  const aliases = overrides.flatMap((override) => override.strokePaints ?? []).map((paint) => paint.colorVar?.value?.alias?.guid).filter(Boolean).map(id)
  if (!aliases.includes(variableId)) throw new Error(`${instanceId}: variável de cor esperada não está vinculada ao stroke`)
  const color = nodes.get(variableId)?.variableDataValues?.entries?.[0]?.variableData?.value?.colorValue
  if (!color || color.a !== 1) throw new Error(`${variableId}: cor opaca ausente`)
  const hex = `#${[color.r, color.g, color.b].map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`
  if (!svg.includes(`fill="${hex}"`)) throw new Error(`${file}: cor diverge de ${variableId} (${hex})`)
  console.log(`${file}: geometria, transformações locais e vínculo de cor conferidos com o snapshot`)
}
for (const [file, pathIds, rootId] of [
  ['google-desktop-source.svg', ['70483:244', '70483:245', '70483:250', '70483:251', '70483:252', '70483:253', '70483:254'], '70483:242'],
  ['facebook-desktop-source.svg', ['70483:260'], '70483:259'],
]) {
  const svg = await readFile(`docs/figma-inspection/asset-comparisons/${file}`, 'utf8')
  function sourcePaintOrder(parentId) {
    return decoded.nodeChanges.filter((node) => node.parentIndex?.guid && id(node.parentIndex.guid) === parentId)
      .sort((a, b) => a.parentIndex.position < b.parentIndex.position ? -1 : a.parentIndex.position > b.parentIndex.position ? 1 : 0)
      .flatMap((node) => [...(node.fillGeometry?.length ? [id(node.guid)] : []), ...sourcePaintOrder(id(node.guid))])
  }
  if (JSON.stringify(sourcePaintOrder(rootId)) !== JSON.stringify(pathIds)) throw new Error(`${file}: sequência de nós diverge da ordem de pintura do snapshot`)
  const matrices = [...svg.matchAll(/transform="matrix\(([^)]+)\)"/g)].map((match) => match[1].trim().split(/[\s,]+/).map(Number))
  const svgPaths = [...svg.matchAll(/<path fill="(#[0-9a-f]+)" d="([^"]+)"/g)].map((match) => ({ color: match[1], tokens: match[2].match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? [] }))
  let lastPathIndex = -1
  for (const pathId of pathIds) {
    const pathNode = nodes.get(pathId)
    const paint = pathNode?.fillPaints?.[0]
    const variableId = paint?.colorVar?.value?.alias?.guid
    const color = variableId && nodes.get(id(variableId))?.variableDataValues?.entries?.[0]?.variableData?.value?.colorValue
    if (!color || color.a !== 1) throw new Error(`${pathId}: variável de cor indisponível`)
    const hex = `#${[color.r, color.g, color.b].map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`
    for (const part of pathNode.fillGeometry ?? []) {
      const expectedPath = decodePath(part.commandsBlob)
      const expected = expectedPath.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? []
      const pathIndex = svgPaths.findIndex((candidate) => candidate.color === hex && candidate.tokens.length === expected.length && candidate.tokens.every((token, index) => {
        const left = Number(token), right = Number(expected[index])
        return Number.isFinite(left) && Number.isFinite(right) ? Math.abs(left - right) <= 1e-6 : token === expected[index]
      }))
      if (pathIndex <= lastPathIndex) throw new Error(`${file}: geometria, cor ou ordem de pintura de ${pathId} divergente`)
      lastPathIndex = pathIndex
    }
    let node = pathNode
    let bounds = { x: 0, y: 0, width: pathNode.size.x, height: pathNode.size.y }
    while (node && id(node.guid) !== rootId) {
      const t = node.transform
      const expected = [t.m00, t.m10, t.m01, t.m11, t.m02, t.m12]
      if (!matrices.some((matrix) => matrix.length === 6 && matrix.every((value, index) => Math.abs(value - expected[index]) < 1e-9))) throw new Error(`${file}: transformação de ${id(node.guid)} divergente`)
      if (Math.abs(t.m00 - 1) > 1e-9 || Math.abs(t.m11 - 1) > 1e-9 || Math.abs(t.m01) > 1e-9 || Math.abs(t.m10) > 1e-9) throw new Error(`${file}: limites exigem transformação não suportada em ${id(node.guid)}`)
      bounds = { ...bounds, x: bounds.x + t.m02, y: bounds.y + t.m12 }
      const parent = nodes.get(id(node.parentIndex.guid))
      if (parent?.frameMaskDisabled === false && (bounds.x < -0.0001 || bounds.y < -0.0001 || bounds.x + bounds.width > parent.size.x + 0.0001 || bounds.y + bounds.height > parent.size.y + 0.0001)) throw new Error(`${file}: limites do nó ${pathId} ultrapassam frame ${id(parent.guid)}`)
      node = parent
    }
    if (!node) throw new Error(`${pathId}: nó não pertence à raiz ${rootId}`)
  }
  console.log(`${file}: geometrias, ordem de pintura, limites declarados, transformações locais e cores conferidos com o snapshot`)
}
console.log('Limites usam as dimensões declaradas pelo arquivo; não comprovam a forma efetiva do clipping, todos os overrides ou equivalência visual.')
