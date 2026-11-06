import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createCatalogSeed, CATEGORIES, NETWORKS } from '../src/mocks/catalog-seed.ts'
import { nftSchema } from '../src/shared/contracts.ts'

test('catalog seed is deterministic, valid and exercises all filters and pages', async () => {
  const catalog = createCatalogSeed()
  assert.deepEqual(catalog, createCatalogSeed())
  assert.equal(catalog.length, 36)
  assert.equal(new Set(catalog.map((item) => item.id)).size, 36)
  assert.deepEqual(new Set(catalog.map((item) => item.category)), new Set(CATEGORIES))
  assert.deepEqual(new Set(catalog.map((item) => item.network)), new Set(NETWORKS))
  const artUrls = new Set(catalog.map((item) => item.artUrl))
  assert.equal(artUrls.size, 4)
  for (const url of artUrls) assert.ok((await stat(join(process.cwd(), 'public', url))).size > 0)
  for (const item of catalog) assert.equal(nftSchema.safeParse(item).success, true)
  assert.equal(catalog.find((item) => item.id === 'violet-nomad-314')?.tokenId, '#0314')
  assert.equal(catalog.find((item) => item.id === 'ivory-baron-088')?.tokenId, '#0088')
})
