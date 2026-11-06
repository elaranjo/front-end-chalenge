import { z } from 'zod'
import { lineTotal, parseEth } from './money.ts'

/** Shared wire contracts: amounts remain decimal strings at every network boundary. */
export const moneySchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/)
  .transform((amount) => /^0(?:\.0+)?$/.test(amount) ? '0' : amount)
export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'])
export const providerSchema = z.enum(['walletconnect', 'metamask', 'coinbase'])
export const editionIdSchema = z.enum(['one-of-one', 'one-of-ten', 'one-of-fifty', 'open'])
const id = z.string().min(1)
const version = z.number().int().nonnegative().safe()
const quantity = z.number().int().positive().safe()
const stock = z.number().int().nonnegative().safe()
const timestamp = z.iso.datetime()

export const editionSchema = z.object({
  id: editionIdSchema, label: z.string().min(1), unitPrice: moneySchema,
  available: stock, version,
})
export const nftSchema = z.object({
  id, tokenId: id, name: z.string().min(1), category: z.string().min(1),
  network: networkSchema, collection: z.string().min(1),
  attributes: z.array(z.string()), artUrl: z.string().min(1),
  gallery: z.array(z.object({ id, url: z.string().min(1), alt: z.string() })),
  description: z.string(), rating: z.number().min(0).max(5), ratingCount: stock,
  createdAt: timestamp, version, editions: z.array(editionSchema),
})
export const profileSchema = z.object({
  id, displayName: z.string(), username: z.string(), email: z.email(),
  ensName: z.string(), walletNickname: z.string(), avatarUrl: z.string().nullable(), version,
})
export const walletSchema = z.object({
  id, slot: z.enum(['primary', 'secondary']), displayName: z.string(), nickname: z.string(),
  network: networkSchema, profileName: z.string(), address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  secondaryAddress: z.string().optional(), type: providerSchema, referralCode: z.string(),
  email: z.email(), ensName: z.string(), version,
})
export const walletConnectionSchema = z.object({
  id, status: z.enum(['connected', 'refused', 'disconnected']), walletId: id,
  provider: providerSchema, network: networkSchema, version,
})
export const walletListSchema = z.object({ items: z.array(walletSchema).max(2), version })
const required = z.string().trim().min(1)
export const collectorInputSchema = z.object({
  displayName: required, username: required, network: networkSchema, profileName: required,
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), walletType: providerSchema,
  referralCode: required, email: z.email(), ensName: required.regex(/^[a-zA-Z0-9-]+$/),
  secondaryAddress: z.string().optional(), note: z.string().optional(),
})
/** Incomplete field values may be saved while editing; submit uses collectorInputSchema. */
export const checkoutDraftSchema = z.strictObject({
  collector: z.strictObject({
    displayName: z.string().optional(), username: z.string().optional(), network: z.string().optional(), profileName: z.string().optional(),
    address: z.string().optional(), walletType: z.string().optional(), referralCode: z.string().optional(), email: z.string().optional(),
    ensName: z.string().optional(), secondaryAddress: z.string().optional(), note: z.string().optional(),
  }),
  walletId: z.string().optional(), provider: providerSchema.optional(), network: networkSchema.optional(), useOtherWallet: z.boolean(),
})
export const orderInputSchema = z.object({
  quoteId: required, quoteFingerprint: required, cartRevision: version,
  walletId: required, provider: providerSchema, network: networkSchema, connectionId: required,
  collector: collectorInputSchema,
})
export const quoteLineSchema = z.object({
  lineId: id, nftId: id, editionId: editionIdSchema, nftVersion: version,
  editionVersion: version, quantity, unitPrice: moneySchema, lineTotal: moneySchema,
})
export const quoteSchema = z.object({
  id, cartId: id, cartRevision: version, catalogVersion: version, lines: z.array(quoteLineSchema),
  coupon: z.object({ code: z.string().min(1), version }).nullable(),
  subtotal: moneySchema, discount: moneySchema, networkFee: moneySchema, total: moneySchema,
  network: networkSchema, expiresAt: timestamp, fingerprint: id,
}).superRefine((quote, context) => {
  if (![quote.subtotal, quote.discount, quote.networkFee, quote.total, ...quote.lines.flatMap((line) => [line.unitPrice, line.lineTotal])].every((amount) => moneySchema.safeParse(amount).success) || quote.lines.some((line) => !Number.isSafeInteger(line.quantity) || line.quantity < 1)) return
  const subtotal = quote.lines.reduce((sum, line) => sum + lineTotal(line.unitPrice, line.quantity), 0n)
  for (const [index, line] of quote.lines.entries()) {
    if (lineTotal(line.unitPrice, line.quantity) !== parseEth(line.lineTotal)) context.addIssue({ code: 'custom', path: ['lines', index, 'lineTotal'], message: 'Total da linha inconsistente' })
  }
  const discount = parseEth(quote.discount)
  if (subtotal !== parseEth(quote.subtotal)) context.addIssue({ code: 'custom', path: ['subtotal'], message: 'Subtotal inconsistente' })
  if (discount > subtotal) context.addIssue({ code: 'custom', path: ['discount'], message: 'Desconto maior que subtotal' })
  if (subtotal - discount + parseEth(quote.networkFee) !== parseEth(quote.total)) context.addIssue({ code: 'custom', path: ['total'], message: 'Total inconsistente' })
})
export const cartLineSchema = z.object({
  lineId: id, nftId: id, editionId: editionIdSchema, quantity,
  nft: nftSchema, unitPrice: moneySchema, available: stock,
})
export const cartSchema = z.object({
  id, ownerKind: z.enum(['visitor', 'user']), revision: version, catalogVersion: version,
  lines: z.array(cartLineSchema), couponCode: z.string().nullable(), quote: quoteSchema.nullable(),
  adjustments: z.array(z.string()),
}).superRefine((cart, context) => {
  const seen = new Set<string>()
  for (const line of cart.lines) {
    if (seen.has(line.lineId) || line.nft.id !== line.nftId) context.addIssue({ code: 'custom', path: ['lines'], message: 'Itens do carrinho inconsistentes' })
    seen.add(line.lineId)
  }
  const quote = cart.quote
  if (!quote) return
  if (quote.cartId !== cart.id || quote.cartRevision !== cart.revision || quote.catalogVersion !== cart.catalogVersion || quote.lines.length !== cart.lines.length || (quote.coupon?.code ?? null) !== cart.couponCode) {
    context.addIssue({ code: 'custom', path: ['quote'], message: 'Cotação não corresponde ao carrinho' })
    return
  }
  const quoted = new Map(quote.lines.map((line) => [line.lineId, line]))
  if (quoted.size !== quote.lines.length || cart.lines.some((line) => {
    const item = quoted.get(line.lineId)
    const edition = line.nft.editions.find((entry) => entry.id === line.editionId)
    return !item || !edition || item.nftId !== line.nftId || item.editionId !== line.editionId || item.quantity !== line.quantity || item.nftVersion !== line.nft.version || item.editionVersion !== edition.version || item.unitPrice !== line.unitPrice || edition.unitPrice !== line.unitPrice || edition.available !== line.available
  })) context.addIssue({ code: 'custom', path: ['quote', 'lines'], message: 'Itens da cotação não correspondem ao carrinho' })
})
export const apiErrorSchema = z.object({
  error: z.object({ code: id, message: z.string(), fieldErrors: z.record(z.string(), z.string()).optional(), retryable: z.boolean() }),
  requestId: id,
})
export const sessionSchema = z.object({ token: id, sessionId: id, userId: id, expiresAt: timestamp, profile: profileSchema })
export const catalogPageSchema = z.object({
  items: z.array(nftSchema), total: stock, page: z.number().int().positive().safe(), pageSize: z.literal(9),
  hasNext: z.boolean(), catalogVersion: version,
  facets: z.object({ categories: z.record(z.string(), stock), networks: z.record(z.string(), stock) }),
})
export const orderItemSchema = z.object({ nft: nftSchema, lineId: id, editionId: editionIdSchema, quantity, unitPrice: moneySchema, lineTotal: moneySchema }).superRefine((item, context) => {
  if (!moneySchema.safeParse(item.unitPrice).success || !moneySchema.safeParse(item.lineTotal).success || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return
  if (lineTotal(item.unitPrice, item.quantity) !== parseEth(item.lineTotal)) context.addIssue({ code: 'custom', path: ['lineTotal'], message: 'Total da linha inconsistente' })
})
export const orderSchema = z.object({
  id, version, ownerUserId: id, status: z.enum(['pending', 'confirmed', 'declined']), createdAt: timestamp, updatedAt: timestamp,
  snapshot: z.object({ quote: quoteSchema, collector: z.record(z.string(), z.string()), walletId: id, wallet: walletSchema, provider: providerSchema, network: networkSchema, items: z.array(orderItemSchema) }),
  transaction: z.object({ id, network: networkSchema, simulated: z.literal(true) }).optional(), declineReason: z.string().min(1).optional(),
}).superRefine((order, context) => {
  if (order.status === 'confirmed' && !order.transaction) context.addIssue({ code: 'custom', path: ['transaction'], message: 'Transação obrigatória para confirmação' })
  if (order.status !== 'confirmed' && order.transaction) context.addIssue({ code: 'custom', path: ['transaction'], message: 'Transação somente em pedido confirmado' })
  if (order.status === 'declined' && !order.declineReason) context.addIssue({ code: 'custom', path: ['declineReason'], message: 'Motivo de recusa obrigatório' })
})

export type NFT = z.infer<typeof nftSchema>
export type Edition = z.infer<typeof editionSchema>
export type Profile = z.infer<typeof profileSchema>
export type Wallet = z.infer<typeof walletSchema>
export type Cart = z.infer<typeof cartSchema>
export type Quote = z.infer<typeof quoteSchema>
export type ApiError = z.infer<typeof apiErrorSchema>
export type Session = z.infer<typeof sessionSchema>
export type CatalogPage = z.infer<typeof catalogPageSchema>
export type Order = z.infer<typeof orderSchema>
export type CheckoutDraft = z.infer<typeof checkoutDraftSchema>
