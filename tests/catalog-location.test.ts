import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { catalogSearchParams } from '../src/shared/catalog-client.ts'
import { parseCatalogLocation, updateCatalogLocation } from '../src/shared/catalog-location.ts'

test('catalog URL normalizes invalid values while preserving valid combined filters', () => {
  const input = new URLSearchParams('q=%20ape%20&category=M%C3%BAsica&category=M%C3%BAsica&category=invalid&network=polygon&network=bad&min=0.0100&max=3&sort=price-asc&tab=trending&page=2')
  const parsed = parseCatalogLocation(input, ['Música', 'Arte digital'])
  assert.deepEqual(parsed, { q: 'ape', category: ['Música'], network: ['polygon'], min: '0.01', max: '3', sort: 'price-asc', tab: 'trending', page: 2 })
  assert.deepEqual(parseCatalogLocation(catalogSearchParams(parsed), ['Música', 'Arte digital']), parsed)
  assert.equal(updateCatalogLocation(parsed, { q: 'novo' }).page, 1)
})

test('invalid page, sort and reversed or malformed bounds are removed', () => {
  assert.deepEqual(parseCatalogLocation(new URLSearchParams('page=-1&sort=bad&tab=bad&min=3&max=1'), []), { page: 1 })
  assert.deepEqual(parseCatalogLocation(new URLSearchParams('page=9007199254740992&min=1e2&max=0.25'), []), { max: '0.25', page: 1 })
})
