import type { AxiosInstance } from 'axios'
import { cartSchema } from './contracts.ts'
import { z } from 'zod'

export const VISITOR_KEY = 'kurio.visitor-id'
export const PENDING_MERGE_KEY = 'kurio.pending-cart-merge'
const adjustmentSchema = z.object({ nftId: z.string(), editionId: z.string(), requested: z.number().int(), accepted: z.number().int() })
const mergeResponseSchema = z.object({ cart: cartSchema, adjustments: z.array(adjustmentSchema) })

export function visitorId(storage: Storage): string {
  const existing = storage.getItem(VISITOR_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  storage.setItem(VISITOR_KEY, created)
  return created
}

export function rotateVisitorId(storage: Storage): string {
  const created = crypto.randomUUID()
  storage.setItem(VISITOR_KEY, created)
  return created
}

/** Keep the same visitor and merge key after failure; rotate only after a valid server response. */
export async function mergeVisitorCart(http: AxiosInstance, storage: Storage, token: string, isCurrent: () => boolean = () => true, pendingVisitorId?: string) {
  const originalId = pendingVisitorId ?? visitorId(storage)
  const response = await http.post('/cart/merge', { visitorId: originalId, mergeKey: originalId }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const result = mergeResponseSchema.parse(response.data)
  if (!isCurrent()) throw new Error('Session changed during cart merge')
  if (storage.getItem(VISITOR_KEY) === originalId) rotateVisitorId(storage)
  return result
}
