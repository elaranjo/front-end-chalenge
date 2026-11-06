import { FavoritesClient } from '../shared/favorites-client.ts'
import { api } from '../shared/http.ts'
import { queryClient } from './query-client.ts'
import type { EventGate } from '../realtime/event-gate.ts'
import { sessionManager } from './session.ts'

let getGate: () => EventGate | null = () => null
export function setFavoritesQueryGate(provider: () => EventGate | null) { getGate = provider }
export const favorites = new FavoritesClient(api, queryClient, sessionManager, () => getGate())
