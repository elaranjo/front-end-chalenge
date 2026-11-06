import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createCatalogSeed } from '../src/mocks/catalog-seed.ts'
import { queryCatalog } from '../src/mocks/catalog-query.ts'

test('combines OR within dimensions and AND across filters with inclusive prices', () => {
  const catalog = createCatalogSeed()
  const query = { category: ['Arte digital', 'Fotografia'], network: ['ethereum', 'polygon'], min: '1.19', max: '1.69' }
  const result = queryCatalog(catalog, query, 3)
  const expected = catalog.filter((item) => query.category.includes(item.category) && query.network.includes(item.network) && Number(item.editions[0].unitPrice) >= 1.19 && Number(item.editions[0].unitPrice) <= 1.69)
  assert.equal(result.total, expected.length)
  assert.ok(result.total > 0)
  assert.equal(result.catalogVersion, 3)
  assert.equal(result.facets.categories['Arte digital'], 4)
})

test('sort, stable pagination, search and empty results follow the query', () => {
  const catalog = createCatalogSeed()
  const first = queryCatalog(catalog, { sort: 'name-asc', page: 1 }, 1)
  const second = queryCatalog(catalog, { sort: 'name-asc', page: 2 }, 1)
  assert.equal(first.items.length, 9)
  assert.equal(first.total, 36)
  assert.equal(first.hasNext, true)
  assert.equal(first.items.some((item) => second.items.some((other) => other.id === item.id)), false)
  const pages = [1, 2, 3, 4].map((page) => queryCatalog(catalog, { sort: 'name-asc', page }, 1))
  assert.deepEqual(pages.map((page) => page.items.length), [9, 9, 9, 9])
  assert.deepEqual(pages.map((page) => page.hasNext), [true, true, true, false])
  assert.equal(new Set(pages.flatMap((page) => page.items.map((item) => item.id))).size, 36)
  assert.equal(queryCatalog(catalog, { q: 'not-a-product' }, 1).total, 0)
  assert.equal(queryCatalog(catalog, { q: '#0042' }, 1).items[0].id, 'emerald-ape-042')
  assert.throws(() => queryCatalog(catalog, { min: '2', max: '1' }, 1), RangeError)
  assert.throws(() => queryCatalog(catalog, { page: 0 }, 1), RangeError)
})
