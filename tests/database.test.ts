import 'fake-indexeddb/auto'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { DATABASE_VERSION, openMockDatabase, resetMockDatabase, STORES, transact } from '../src/mocks/database.ts'

function read(database: IDBDatabase, store: string, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(store).objectStore(store).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

test('transactions commit across stores and roll back all writes on failure', async () => {
  const database = await openMockDatabase('test-atomic')
  assert.equal(database.version, DATABASE_VERSION)
  assert.deepEqual([...database.objectStoreNames].sort(), [...STORES].sort())
  await transact(database, ['orders', 'reservations'], 'readwrite', (transaction) => {
    transaction.objectStore('orders').add({ id: 'order-1', status: 'pending' })
    transaction.objectStore('reservations').add({ id: 'reservation-1', quantity: 2 })
  })
  await assert.rejects(transact(database, ['orders', 'reservations'], 'readwrite', (transaction) => {
    transaction.objectStore('orders').put({ id: 'order-1', status: 'confirmed' })
    transaction.objectStore('reservations').add({ id: 'reservation-1', quantity: 2 })
  }))
  assert.deepEqual(await read(database, 'orders', 'order-1'), { id: 'order-1', status: 'pending' })
  assert.deepEqual(await read(database, 'reservations', 'reservation-1'), { id: 'reservation-1', quantity: 2 })
  database.close()
})

test('reset clears old state and seeds every store in one transaction', async () => {
  const database = await openMockDatabase('test-reset')
  await resetMockDatabase(database, { users: [{ id: 'old-user' }], orders: [{ id: 'old-order' }] })
  await assert.rejects(resetMockDatabase(database, { users: [{ id: 'duplicate' }, { id: 'duplicate' }] }))
  assert.deepEqual(await read(database, 'users', 'old-user'), { id: 'old-user' })
  assert.deepEqual(await read(database, 'orders', 'old-order'), { id: 'old-order' })
  await resetMockDatabase(database, { users: [{ id: 'new-user' }] })
  assert.equal(await read(database, 'users', 'old-user'), undefined)
  assert.equal(await read(database, 'orders', 'old-order'), undefined)
  assert.deepEqual(await read(database, 'users', 'new-user'), { id: 'new-user' })
  database.close()
})

test('does not allow an asynchronous transaction callback', async () => {
  const database = await openMockDatabase('test-async')
  await assert.rejects(transact(database, ['orders'], 'readwrite', async () => {}), /must not return a Promise/)
  database.close()
})
