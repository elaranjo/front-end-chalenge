import { CartClient } from '../shared/cart-client.ts'
import { CheckoutDraftStore } from '../shared/checkout-draft.ts'
import { CheckoutSubmission } from '../shared/checkout-submission.ts'
import { CheckoutQuoteClient } from '../shared/checkout-quote.ts'
import { api } from '../shared/http.ts'
import { OrderAttemptManager } from '../shared/order-attempt.ts'
import { ProfileClient } from '../shared/profile-client.ts'
import { WalletClient } from '../shared/wallet-client.ts'
import { queryClient } from './query-client.ts'
import { realtime } from './realtime.ts'
import { sessionManager } from './session.ts'

const gate = () => realtime.currentGate

export const cart = new CartClient(api, queryClient, sessionManager, window.localStorage, gate)
export const profile = new ProfileClient(api, queryClient, sessionManager, gate)
export const wallets = new WalletClient(api, queryClient, sessionManager)
export const checkoutDraft = new CheckoutDraftStore(sessionManager, window.localStorage)
export const checkoutQuotes = new CheckoutQuoteClient(api, sessionManager, gate)
export const orderAttempts = new OrderAttemptManager(api, sessionManager, window.localStorage)
export const checkout = new CheckoutSubmission(api, sessionManager, orderAttempts, () => realtime.isReady, gate)
