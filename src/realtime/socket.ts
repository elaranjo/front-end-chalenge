import { io } from 'socket.io-client'

/** Call only after MSW starts so the native WebSocket is intercepted. */
export function createSocket(origin: string) {
  return io(origin, { transports: ['websocket'], upgrade: false, autoConnect: false })
}
