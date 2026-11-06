import type { EventGate } from '../realtime/event-gate.ts'
import { cartQueries } from '../shared/cart-queries.ts'
import { api } from '../shared/http.ts'
import { sessionManager } from './session.ts'

let getGate: () => EventGate | null = () => null
export function setCartQueryGate(provider: () => EventGate | null) { getGate = provider }
export const shoppingCartQueries = cartQueries(api, sessionManager, window.localStorage, () => getGate())
