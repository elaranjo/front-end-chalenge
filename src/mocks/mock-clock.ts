export type MockClockState = { mode: 'real' | 'manual'; now: number }
export type MockNow = () => number | Promise<number>
const KEY = 'mock-clock'
const INITIAL_TIME = Date.parse('2026-07-29T12:00:00.000Z')

/** Clock state lives in IndexedDB so separate tabs observe the same simulated time. */
export async function readMockClock(database: IDBDatabase, realNow: () => number = Date.now): Promise<MockClockState> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('scenario', 'readonly')
    const request = tx.objectStore('scenario').get(KEY)
    tx.oncomplete = () => {
      const value = request.result
      if (!value) resolve({ mode: 'real', now: realNow() })
      else if (value.mode === 'real' && Number.isSafeInteger(value.base) && Number.isSafeInteger(value.wallStart)) resolve({ mode: 'real', now: value.base + Math.max(0, realNow() - value.wallStart) })
      else if (value.mode === 'manual' && Number.isSafeInteger(value.now) && value.now >= 0) resolve({ mode: 'manual', now: value.now })
      else reject(new Error('Invalid simulated clock'))
    }
    tx.onabort = () => reject(tx.error ?? new Error('Clock read failed'))
  })
}

export function initialMockClock(mode: 'real' | 'manual', wallNow: () => number = Date.now) {
  return { id: KEY, mode, ...(mode === 'manual' ? { now: INITIAL_TIME } : { base: INITIAL_TIME, wallStart: wallNow() }) }
}

/** Initialize once without replacing an existing scenario in another tab. */
export async function initializeMockClock(database: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('scenario', 'readwrite')
    const store = tx.objectStore('scenario')
    const request = store.get(KEY)
    request.onsuccess = () => { if (!request.result) store.add(initialMockClock('real')) }
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('Clock initialization failed'))
  })
}

/** Advances are serialized with other writes and cannot silently change a real clock. */
export async function advanceMockClock(database: IDBDatabase, advanceMs: number): Promise<MockClockState> {
  if (!Number.isSafeInteger(advanceMs) || advanceMs < 0) throw new RangeError('Invalid clock advance')
  return new Promise((resolve, reject) => {
    const tx = database.transaction('scenario', 'readwrite')
    const store = tx.objectStore('scenario')
    const request = store.get(KEY)
    let result: MockClockState
    let failure: Error | undefined
    request.onsuccess = () => {
      const value = request.result
      if (!value || value.mode !== 'manual' || !Number.isSafeInteger(value.now) || value.now < 0 || !Number.isSafeInteger(value.now + advanceMs)) {
        failure = new Error('Manual clock unavailable')
        tx.abort()
        return
      }
      result = { mode: 'manual', now: value.now + advanceMs }
      store.put({ id: KEY, ...result })
    }
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Clock advance failed'))
  })
}
