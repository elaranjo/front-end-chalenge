import { z } from 'zod'
import { checkoutDraftSchema, type CheckoutDraft } from './contracts.ts'
import type { SessionManager } from './session.ts'

export const CHECKOUT_DRAFT_KEY = 'kurio.checkout-draft'
const storedDraftSchema = z.strictObject({ ownerUserId: z.string().min(1), draft: checkoutDraftSchema })

/** Only the owning account can read or replace a locally saved draft. */
export class CheckoutDraftStore {
  private readonly sessions: SessionManager
  private readonly storage: Storage
  constructor(sessions: SessionManager, storage: Storage) { this.sessions = sessions; this.storage = storage }
  save(draft: CheckoutDraft): void {
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    const parsed = storedDraftSchema.parse({ ownerUserId: session.userId, draft })
    this.storage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(parsed))
  }
  load(): CheckoutDraft | null {
    const session = this.sessions.session
    if (!session) return null
    const raw = this.storage.getItem(CHECKOUT_DRAFT_KEY)
    if (!raw) return null
    let data: unknown
    try { data = JSON.parse(raw) } catch { throw new Error('Invalid stored checkout draft') }
    const parsed = storedDraftSchema.parse(data)
    return parsed.ownerUserId === session.userId ? parsed.draft : null
  }
  clear(): void { this.storage.removeItem(CHECKOUT_DRAFT_KEY) }
}
