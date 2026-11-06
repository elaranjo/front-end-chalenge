import type { QueryClient } from '@tanstack/react-query'
import type { SessionManager } from './session.ts'
import { ORDER_ATTEMPT_KEY } from './order-attempt.ts'
import { PENDING_MERGE_KEY, VISITOR_KEY } from './visitor-cart.ts'
import { CHECKOUT_DRAFT_KEY } from './checkout-draft.ts'

/** Reset client-side state only after the mock server has committed its reset. */
export async function clearClientForMockReset(sessions: SessionManager, queries: QueryClient, storage: Storage, generation: string): Promise<void> {
  storage.removeItem(ORDER_ATTEMPT_KEY)
  storage.removeItem(CHECKOUT_DRAFT_KEY)
  storage.removeItem(PENDING_MERGE_KEY)
  storage.setItem(VISITOR_KEY, generation)
  // Invalidate the session generation synchronously before pending requests can finish.
  const sessionReset = sessions.clear()
  await queries.cancelQueries()
  await sessionReset
  queries.clear()
}
