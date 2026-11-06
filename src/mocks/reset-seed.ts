import { createVisualCart } from './cart-repository.ts'
import { profileFor } from './auth-handlers.ts'
import { createCatalogSeed } from './catalog-seed.ts'
import { resetMockDatabase, STORES, type StoreName } from './database.ts'
import { SEED_USERS } from './user-seed.ts'
import { initialMockClock } from './mock-clock.ts'

/** Restore server state in one IndexedDB transaction; client teardown is a separate requirement. */
export const supportedScenarios = ['default', 'visual-desktop', 'visual-mobile', 'empty', 'coupon-expired', 'coupon-invalid', 'price-change', 'sold-out', 'fee-change', 'pending-disconnect', 'duplicate-old-events', 'payment-confirmed', 'payment-declined', 'timeout-after-order-create', 'slow', 'out-of-order', 'network-error', 'http-400', 'http-401', 'http-403', 'http-404', 'http-409', 'http-422', 'http-500', 'http-503', 'favorite-failure', 'signup-conflict', 'validation-errors', 'session-expired'] as const
export type SupportedScenario = (typeof supportedScenarios)[number]
function buildSeed(generation: string, clockMode: 'real' | 'manual', scenarioName: SupportedScenario, seed: number): Partial<Record<StoreName, readonly { id: IDBValidKey }[]>> {
  const catalog = scenarioName === 'empty' ? [] : createCatalogSeed()
  if (scenarioName === 'sold-out') {
    const edition = catalog.find((item) => item.id === 'emerald-ape-042')?.editions.find((item) => item.id === 'one-of-one')
    if (!edition) throw new Error('Sold-out fixture is unavailable')
    edition.available = 0
  }
  const scenario: Array<{ id: string } & Record<string, unknown>> = [
    { id: 'accounts-meta', version: 1 },
    { id: 'catalog-meta', catalogVersion: 1 },
    { id: 'reset-generation', generation },
    initialMockClock(clockMode),
    { id: 'scenario-config', name: scenarioName, seed },
  ]
  if (scenarioName === 'coupon-expired') scenario.push({ id: 'coupon:KURIO10', code: 'KURIO10', expired: true, version: 2 })
  if (scenarioName === 'payment-declined' || scenarioName === 'payment-confirmed') scenario.push({ id: 'payment-behavior', decline: scenarioName === 'payment-declined' })
  const visual = scenarioName === 'visual-mobile' || scenarioName === 'visual-desktop'
    ? createVisualCart({ kind: 'visitor', id: generation }, scenarioName)
    : undefined
  if (visual) scenario.push({ id: 'visual-cart-claim', owner: visual.id })
  return {
    ...(visual ? { carts: [visual] } : {}),
    users: SEED_USERS,
    profiles: SEED_USERS.map(profileFor),
    catalog,
    scenario,
  }
}

export async function resetDefaultServerState(database: IDBDatabase, clockMode: 'real' | 'manual' = 'real', scenarioName: SupportedScenario = 'default', seed = 0): Promise<string> {
  const generation = crypto.randomUUID()
  await resetMockDatabase(database, buildSeed(generation, clockMode, scenarioName, seed))
  return generation
}

/** Multiple tabs selecting the same scenario share one atomic check-and-reset. */
export async function selectServerScenario(database: IDBDatabase, scenarioName: SupportedScenario): Promise<string | null> {
  const generation = crypto.randomUUID()
  const seed = buildSeed(generation, 'real', scenarioName, 0)
  return new Promise((resolve, reject) => {
    const tx = database.transaction([...STORES], 'readwrite')
    const config = tx.objectStore('scenario').get('scenario-config')
    let changed = false
    config.onsuccess = () => {
      if ((config.result?.name ?? 'default') === scenarioName) return
      changed = true
      for (const name of STORES) {
        const store = tx.objectStore(name)
        store.clear()
        for (const record of seed[name] ?? []) store.add(record)
      }
    }
    tx.oncomplete = () => resolve(changed ? generation : null)
    tx.onabort = () => reject(tx.error ?? new Error('Scenario selection failed'))
  })
}
