/** Storage for the simulated server. No application feature should import this module. */
export const DATABASE_NAME = 'kurio-mock'
export const DATABASE_VERSION = 1
export const STORES = [
  'users', 'sessions', 'catalog', 'favorites', 'carts', 'quotes', 'wallets',
  'profiles', 'avatars', 'orders', 'reservations', 'ledger', 'outbox', 'scenario',
] as const
export type StoreName = (typeof STORES)[number]

/** The caller supplies id-bearing records and awaits the transaction, not individual writes. */
export function openMockDatabase(name = DATABASE_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const store of STORES) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' })
      }
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to open mock database'))
    request.onblocked = () => reject(new Error('Mock database upgrade is blocked by another tab'))
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
  })
}

/** Queue all requests synchronously; await crypto and network before entering this function. */
export function transact<T>(
  database: IDBDatabase,
  stores: readonly StoreName[],
  mode: IDBTransactionMode,
  queue: (transaction: IDBTransaction) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([...stores], mode)
    let result: T
    transaction.oncomplete = () => resolve(result)
    transaction.onabort = () => reject(transaction.error ?? new Error('Mock transaction aborted'))
    transaction.onerror = () => { /* The abort handler reports the transaction failure. */ }
    try {
      result = queue(transaction)
      if (result instanceof Promise) throw new TypeError('Queue must not return a Promise')
    } catch (error) {
      transaction.abort()
      reject(error)
    }
  })
}

/** Clear and seed all server stores atomically; caller clears client state separately. */
export function resetMockDatabase(
  database: IDBDatabase,
  seed: Partial<Record<StoreName, readonly { id: IDBValidKey }[]>>,
): Promise<void> {
  return transact(database, STORES, 'readwrite', (transaction) => {
    for (const name of STORES) {
      const store = transaction.objectStore(name)
      store.clear()
      for (const record of seed[name] ?? []) store.add(record)
    }
  })
}
