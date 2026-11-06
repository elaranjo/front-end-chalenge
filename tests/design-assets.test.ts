import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const pngSize = (bytes: Buffer) => {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

test('preserved Figma references and available assets match their recorded hashes', async () => {
  const source = await readFile('docs/figma-inspection/source/frontend-challenge.fig')
  assert.equal(digest(source), '7017e04fa195974ae22a27c78dc88413eb5292a849bf4defbe295062813e0dbd')
  const references = JSON.parse(await readFile('docs/figma-inspection/references/manifest.json', 'utf8')) as { frames: Array<{ file: string; width: number; height: number; sha256: string }> }
  assert.equal(references.frames.length, 15)
  for (const frame of references.frames) {
    const bytes = await readFile(join('docs/figma-inspection/references', frame.file))
    assert.equal(digest(bytes), frame.sha256, frame.file)
    assert.deepEqual(pngSize(bytes), [frame.width, frame.height], frame.file)
  }
  const rasters = JSON.parse(await readFile('docs/figma-inspection/data/raster-assets.json', 'utf8')) as Array<{ filename: string; width: number; height: number; sha256: string }>
  assert.equal(rasters.length, 4)
  for (const asset of rasters) {
    for (const directory of ['docs/figma-inspection/assets', 'public/assets/nft']) {
      const bytes = await readFile(join(directory, asset.filename))
      assert.equal(digest(bytes), asset.sha256, asset.filename)
      assert.deepEqual(pngSize(bytes), [asset.width, asset.height], asset.filename)
    }
  }
  const vectors = JSON.parse(await readFile('public/assets/icons/manifest.json', 'utf8')) as { assets: Array<{ file: string; nodeId: string; sha256: string }> }
  const files = (await readdir('public/assets/icons')).filter((file) => file.endsWith('.svg')).sort()
  assert.deepEqual(vectors.assets.map((asset) => asset.file).sort(), files, 'all local SVGs must appear exactly once in the source manifest')
  for (const asset of vectors.assets) {
    assert.match(asset.nodeId, /^\d+:\d+(?:\s*\/\s*\d+:\d+)*$/, asset.file)
    assert.equal(digest(await readFile(join('public/assets/icons', asset.file))), asset.sha256, asset.file)
  }
  assert.match(await readFile('node_modules/@fontsource-variable/roboto-mono/LICENSE', 'utf8'), /SIL Open Font License/)
})
