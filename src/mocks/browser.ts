import { setupWorker } from 'msw/browser'
import { catalogHandlers, openCatalog } from './catalog-handlers.ts'
import { authHandlers, initializeAccounts } from './auth-handlers.ts'
import { cartHandlers } from './cart-handlers.ts'
import { walletHandlers } from './wallet-handlers.ts'
import { orderHandlers } from './order-handlers.ts'
import { socketHandlers } from './socket-handlers.ts'
import { startOutboxBridge } from './outbox-bridge.ts'
import { profileHandlers } from './profile-handlers.ts'
import { favoriteHandlers } from './favorite-handlers.ts'
import { controlHandlers } from './control-handlers.ts'
import { initializeMockClock, readMockClock } from './mock-clock.ts'
import { startOrderScheduler } from './order-scheduler.ts'
import { scenarioNetworkHandlers } from './scenario-network.ts'
import { selectServerScenario, supportedScenarios, type SupportedScenario } from './reset-seed.ts'
import { announceMockReset } from '../shared/reset-signal.ts'

async function selectRequestedScenario(database: IDBDatabase) {
  const requested = new URL(location.href).searchParams.get('mockScenario')
  if (!requested) return
  if (!(supportedScenarios as readonly string[]).includes(requested)) throw new Error('Unknown mock scenario')
  const generation = await selectServerScenario(database, requested as SupportedScenario)
  if (generation) announceMockReset(generation)
}

export async function startMocks() {
  const database = await openCatalog()
  let stopScheduler: (() => void) | undefined
  try {
    await initializeAccounts(database)
    await initializeMockClock(database)
    await selectRequestedScenario(database)
    startOutboxBridge()
    stopScheduler = await startOrderScheduler(database)
    const now = async () => (await readMockClock(database)).now
    const worker = setupWorker(...scenarioNetworkHandlers(database), ...catalogHandlers(database), ...authHandlers(database, now), ...profileHandlers(database, now), ...favoriteHandlers(database, now), ...cartHandlers(database, now), ...walletHandlers(database, now), ...orderHandlers(database, now), ...controlHandlers(database, now), ...socketHandlers(database, location.origin, now))
    await worker.start({ onUnhandledRequest: 'bypass' })
    return { database, worker }
  } catch (error) {
    stopScheduler?.()
    database.close()
    throw error
  }
}
