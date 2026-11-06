const listeners = new Set<() => void>()
const disconnectListeners = new Set<() => void>()
type Replay = { eventId: string; replacementId?: string }
const replayListeners = new Set<(replay: Replay) => void>()
let channel: BroadcastChannel | undefined

/** Notifications only wake the mock transport; event data always comes from IndexedDB. */
export function startOutboxBridge() {
  if (!channel) {
    channel = new BroadcastChannel('kurio-mock-outbox')
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data as Record<string, unknown> | null
      if (typeof data === 'object' && data !== null && data.kind === 'replay' && typeof data.eventId === 'string' && (data.replacementId === undefined || typeof data.replacementId === 'string')) {
        for (const listener of replayListeners) listener({ eventId: data.eventId, replacementId: data.replacementId as string | undefined })
        return
      }
      const targets = event.data === 'disconnect' ? disconnectListeners : listeners
      for (const listener of targets) listener()
    }
  }
}

export function notifyOutbox() {
  for (const listener of listeners) listener()
  channel?.postMessage('changed')
}

export function onOutboxChange(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Close mock transport connections across tabs without modifying application state. */
export function disconnectMockSockets() {
  for (const listener of disconnectListeners) listener()
  channel?.postMessage('disconnect')
}

export function onMockSocketDisconnect(listener: () => void) {
  disconnectListeners.add(listener)
  return () => { disconnectListeners.delete(listener) }
}

export function replayMockEvent(replay: Replay) {
  for (const listener of replayListeners) listener(replay)
  channel?.postMessage({ kind: 'replay', ...replay })
}

export function onMockEventReplay(listener: (replay: Replay) => void) {
  replayListeners.add(listener)
  return () => { replayListeners.delete(listener) }
}
