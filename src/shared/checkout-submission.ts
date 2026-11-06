import type { AxiosInstance } from 'axios'
import { orderInputSchema, quoteSchema, walletConnectionSchema, type Order, type Quote } from './contracts.ts'
import { OrderAttemptManager, type OrderAttemptInput } from './order-attempt.ts'
import type { SessionManager } from './session.ts'
import type { EventGate } from '../realtime/event-gate.ts'
import { CheckoutQuoteClient } from './checkout-quote.ts'

type Selection = Omit<OrderAttemptInput, 'quoteId' | 'quoteFingerprint' | 'cartRevision' | 'connectionId'>
type Result = { status: 'review-required'; previous: Quote; current: Quote; reason: 'expired' | 'changed' } | { status: 'submitted'; order: Order }

/** IDs and expiry may change on refresh; every reviewed value must still match. */
function reviewedValues(quote: Quote): string {
  return JSON.stringify({ cartId: quote.cartId, cartRevision: quote.cartRevision, catalogVersion: quote.catalogVersion, lines: quote.lines, coupon: quote.coupon, subtotal: quote.subtotal, discount: quote.discount, networkFee: quote.networkFee, total: quote.total, network: quote.network })
}

/** Revalidate the accepted quote before starting a new purchase attempt. */
export class CheckoutSubmission {
  private pending: Promise<Result> | null = null
  private pendingInput: string | null = null
  private readonly sessions: SessionManager
  private readonly attempts: OrderAttemptManager
  private readonly isReady: () => boolean
  private readonly quotes: CheckoutQuoteClient
  constructor(http: AxiosInstance, sessions: SessionManager, attempts: OrderAttemptManager, isReady: () => boolean, getGate: () => EventGate | null, now: () => number = Date.now) {
    this.sessions = sessions
    this.attempts = attempts
    this.isReady = isReady
    this.quotes = new CheckoutQuoteClient(http, sessions, getGate, now)
  }
  submit(reviewed: Quote, selection: Selection, rawConnection: unknown): Promise<Result> {
    const input = JSON.stringify([reviewed, selection, rawConnection])
    if (this.pending) return this.pendingInput === input ? this.pending : Promise.reject(new Error('Another submission is in progress'))
    const operation = this.perform(structuredClone(reviewed), structuredClone(selection), structuredClone(rawConnection))
    this.pending = operation
    this.pendingInput = input
    void operation.finally(() => { if (this.pending === operation) { this.pending = null; this.pendingInput = null } }).catch(() => {})
    return operation
  }
  private async perform(reviewedInput: Quote, selection: Selection, rawConnection: unknown): Promise<Result> {
    const reviewed = quoteSchema.parse(reviewedInput)
    const connection = walletConnectionSchema.parse(rawConnection)
    const validated = orderInputSchema.parse({ ...selection, cartRevision: reviewed.cartRevision, quoteId: reviewed.id, quoteFingerprint: reviewed.fingerprint, connectionId: connection.id })
    if (validated.collector.network !== validated.network) throw new Error('Collector and wallet network must match')
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    if (reviewed.cartId !== `user:${session.userId}`) throw new Error('Quote owner mismatch')
    const generation = this.sessions.sessionGeneration
    if (this.attempts.hasAttempt()) throw new Error('Recover the existing attempt first')
    if (!this.isReady() || connection.status !== 'connected' || connection.walletId !== selection.walletId || connection.provider !== selection.provider || connection.network !== selection.network || reviewed.network !== selection.network) throw new Error('Wallet or realtime state is not ready')
    const { quote: current, checkedAt } = await this.quotes.fetch({ walletId: selection.walletId, network: selection.network, provider: selection.provider, cartRevision: reviewed.cartRevision })
    if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token) throw new Error('Session changed')
    if (!this.isReady()) throw new Error('Realtime state is not ready')
    const changed = reviewed.fingerprint !== current.fingerprint || reviewedValues(reviewed) !== reviewedValues(current)
    const expired = Date.parse(reviewed.expiresAt) <= checkedAt || Date.parse(current.expiresAt) <= checkedAt
    if (changed || expired) return { status: 'review-required', previous: reviewed, current, reason: changed ? 'changed' : 'expired' }
    const order = await this.attempts.create({ ...selection, cartRevision: current.cartRevision, quoteId: current.id, quoteFingerprint: current.fingerprint, connectionId: connection.id })
    return { status: 'submitted', order }
  }
}
