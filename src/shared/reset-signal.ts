type Listener = (generation: string) => void
const listeners = new Set<Listener>()
let channel: BroadcastChannel | undefined

function startChannel() {
  if (typeof window === 'undefined' || channel) return
  channel = new BroadcastChannel('kurio-mock-reset')
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data === 'string' && event.data.length > 0) for (const listener of listeners) listener(event.data)
  }
}
export function onMockReset(listener: Listener): () => void {
  startChannel()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function announceMockReset(generation: string): void {
  startChannel()
  for (const listener of listeners) listener(generation)
  channel?.postMessage(generation)
}
