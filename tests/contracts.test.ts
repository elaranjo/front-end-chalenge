import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { apiErrorSchema, editionSchema, moneySchema, networkSchema } from '../src/shared/contracts.ts'

test('transport rejects numbers, exponents, negative values and excessive precision for ETH', () => {
  for (const value of [1.19, '-1', '1e-8', '0.0000000000000000001']) {
    assert.equal(moneySchema.safeParse(value).success, false)
  }
  assert.equal(moneySchema.parse('0.000000000000000001'), '0.000000000000000001')
  assert.equal(moneySchema.parse('0.000000000000000000'), '0')
})

test('edition stock and version are nonnegative integers', () => {
  const edition = { id: 'one-of-fifty', label: '1/50', unitPrice: '1.19', available: 2, version: 1 }
  assert.equal(editionSchema.safeParse(edition).success, true)
  assert.equal(editionSchema.safeParse({ ...edition, available: -1 }).success, false)
  assert.equal(editionSchema.safeParse({ ...edition, version: 0.5 }).success, false)
  assert.equal(networkSchema.safeParse('unknown').success, false)
})

test('API errors contain a code, request identity and retry decision', () => {
  assert.equal(apiErrorSchema.safeParse({ error: { code: 'INVALID', message: 'Inválido', retryable: false }, requestId: 'r1' }).success, true)
  assert.equal(apiErrorSchema.safeParse({ error: { message: 'Inválido' } }).success, false)
})
