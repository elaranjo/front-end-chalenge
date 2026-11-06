/** ETH values cross the API boundary as decimal strings and are calculated in wei. */
export const WEI_PER_ETH = 10n ** 18n

export function parseEth(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) {
    throw new RangeError('Invalid ETH amount')
  }
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * WEI_PER_ETH + BigInt(fraction.padEnd(18, '0'))
}

export function formatEth(wei: bigint): string {
  if (wei < 0n) throw new RangeError('ETH amount cannot be negative')
  const whole = wei / WEI_PER_ETH
  const fraction = (wei % WEI_PER_ETH).toString().padStart(18, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

/** Localized display keeps the transport representation and its precision separate. */
export function formatEthPtBR(value: string): string {
  const normalized = formatEth(parseEth(value))
  const [whole, fraction] = normalized.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return fraction ? `${grouped},${fraction}` : grouped
}

export function lineTotal(unitPrice: string, quantity: number): bigint {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError('Quantity must be a positive safe integer')
  }
  return parseEth(unitPrice) * BigInt(quantity)
}

export function calculateQuote(lines: ReadonlyArray<{ unitPrice: string; quantity: number }>, fee: string, discountPercent = 0) {
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new RangeError('Invalid discount percentage')
  }
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line.unitPrice, line.quantity), 0n)
  const discount = subtotal * BigInt(discountPercent) / 100n
  const networkFee = parseEth(fee)
  return {
    subtotal: formatEth(subtotal),
    discount: formatEth(discount),
    networkFee: formatEth(networkFee),
    total: formatEth(subtotal - discount + networkFee),
  }
}
