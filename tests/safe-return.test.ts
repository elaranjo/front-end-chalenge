import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { safeReturnTo } from '../src/shared/safe-return.ts'

test('return paths preserve internal destinations and reject external or invalid URLs', () => {
  assert.equal(safeReturnTo('/checkout'), '/checkout')
  assert.equal(safeReturnTo('/?category=Arte%20digital&page=2#catalog'), '/?category=Arte%20digital&page=2#catalog')
  assert.equal(safeReturnTo('/nfts/emerald-ape-042'), '/nfts/emerald-ape-042')
  for (const value of ['https://evil.example/', '//evil.example/', '/\\evil.example/', '/%2f%2fevil.example', '/%5cevil.example', '/login', '/unknown', '/nfts/%ZZ', '/checkout\n']) assert.equal(safeReturnTo(value), '/')
  assert.equal(safeReturnTo(undefined, '/cart'), '/cart')
})
