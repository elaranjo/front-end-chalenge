import type { EventGate } from '../realtime/event-gate.ts'
import { catalogQueries } from '../shared/catalog-queries.ts'
import { api } from '../shared/http.ts'

let getGate: () => EventGate | null = () => null
export function setCatalogQueryGate(provider: () => EventGate | null) { getGate = provider }
let ready = () => false
let revision = () => 0
let subscribe: (listener: () => void) => () => void = () => () => {}
export function setCatalogReadiness(getSnapshot: () => boolean, subscribeReady: (listener: () => void) => () => void, getRevision: () => number) { ready = getSnapshot; subscribe = subscribeReady; revision = getRevision }
export const catalogReady = () => ready()
export const catalogReadinessRevision = () => revision()
export const subscribeCatalogReady = (listener: () => void) => subscribe(listener)
export const discoveryQueries = catalogQueries(api, () => getGate())
