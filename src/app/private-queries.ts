import { privateQueries } from '../shared/private-queries.ts'
import { api } from '../shared/http.ts'
import { sessionManager } from './session.ts'
import type { EventGate } from '../realtime/event-gate.ts'

let getGate: () => EventGate | null = () => null
export function setAccountQueryGate(provider: () => EventGate | null) { getGate = provider }
export const accountQueries = privateQueries(api, sessionManager, () => getGate())
