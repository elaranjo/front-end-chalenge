import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { calculateQuote, formatEth, formatEthPtBR, lineTotal, parseEth } from '../src/shared/money.ts'

test('calculates the mobile cart using exact decimal amounts', () => {
  assert.deepEqual(calculateQuote([
    { unitPrice: '1.19', quantity: 1 }, { unitPrice: '1.39', quantity: 1 },
    { unitPrice: '1.79', quantity: 2 }, { unitPrice: '0.99', quantity: 2 },
  ], '0.016'), { subtotal: '8.14', discount: '0', networkFee: '0.016', total: '8.156' })
})

test('preserves 18 decimal places and truncates discounts in wei', () => {
  assert.equal(formatEth(parseEth('123456789.000000000000000001')), '123456789.000000000000000001')
  assert.deepEqual(calculateQuote([{ unitPrice: '0.000000000000000019', quantity: 1 }], '0', 10), {
    subtotal: '0.000000000000000019', discount: '0.000000000000000001', networkFee: '0', total: '0.000000000000000018',
  })
})

test('formats exact transport values for Portuguese without rounding', () => {
  assert.equal(formatEthPtBR('12345678901234567890.000000000000000001'), '12.345.678.901.234.567.890,000000000000000001')
  assert.equal(formatEthPtBR('0.000'), '0')
  assert.equal(formatEthPtBR('8.156'), '8,156')
  assert.throws(() => formatEthPtBR('1,5'), RangeError)
})

test('rejects malformed money and quantities', () => {
  for (const amount of ['-1', '1e2', '0.0000000000000000001', '', '01', '.1']) {
    assert.throws(() => parseEth(amount), RangeError)
  }
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => lineTotal('1', quantity), RangeError)
  }
})
