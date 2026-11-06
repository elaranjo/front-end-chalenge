import { onMockReset } from '../shared/reset-signal.ts'
import { readMockClock } from './mock-clock.ts'
import { notifyOutbox, onOutboxChange } from './outbox-bridge.ts'
import { OrderConflict, resolvePendingOrder, type StoredOrder } from './order-repository.ts'

/** Keeps due orders moving while at least one mock runtime is open. */
export async function startOrderScheduler(database: IDBDatabase, onError: (error: unknown) => void = console.error) {
  let stopped = false
  let running = false
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  async function scan() {
    if (stopped) return
    if (running) { dirty = true; return }
    running = true
    if (timer) clearTimeout(timer)
    timer = undefined
    try {
      do {
        dirty = false
        if (timer) clearTimeout(timer)
        timer = undefined
        const clock = await readMockClock(database)
        const orders = await new Promise<StoredOrder[]>((resolve, reject) => {
          const tx = database.transaction('orders', 'readonly')
          const request = tx.objectStore('orders').getAll()
          tx.oncomplete = () => resolve(request.result)
          tx.onabort = () => reject(tx.error ?? new Error('Unable to read pending orders'))
        })
        if (stopped) return
        const pending = orders.filter((order) => order.status === 'pending' && order.resolveAt && order.intendedOutcome)
        const due = pending.filter((order) => Date.parse(order.resolveAt!) <= clock.now)
        for (const order of due) {
          if (stopped) return
          try {
            await resolvePendingOrder(database, order.ownerUserId, order.id, order.intendedOutcome!, clock.now)
            notifyOutbox()
          } catch (error) {
            if (!(error instanceof OrderConflict) || !['ORDER_NOT_FOUND', 'ORDER_TERMINAL'].includes(error.code)) throw error
          }
        }
        if (clock.mode === 'real') {
          const next = pending.filter((order) => Date.parse(order.resolveAt!) > clock.now).reduce((minimum, order) => Math.min(minimum, Date.parse(order.resolveAt!)), Infinity)
          if (Number.isFinite(next)) timer = setTimeout(() => { void scan().catch(onError) }, Math.max(1, next - clock.now))
        }
      } while (dirty && !stopped)
    } finally { running = false }
  }
  const wake = () => { void scan().catch(onError) }
  const offOutbox = onOutboxChange(wake)
  const offReset = onMockReset(wake)
  try { await scan() } catch (error) { offOutbox(); offReset(); throw error }
  return () => { stopped = true; if (timer) clearTimeout(timer); offOutbox(); offReset() }
}
