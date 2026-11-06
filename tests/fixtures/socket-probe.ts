import { setupWorker } from 'msw/browser'
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'

// MSW removes /socket.io/ before matching a WebSocket handler.
const link = ws.link(location.origin.replace(/^http/, 'ws'))
const worker = setupWorker(link.addEventListener('connection', (connection) => {
  document.body.dataset.stage = 'intercepted'
  const socket = toSocketIo(connection)
  socket.client.on('test.request', (_event, value) => socket.client.emit('test.response', { value }))
}))

try {
  await worker.start({ onUnhandledRequest: 'bypass' })
  const { io } = await import('socket.io-client')
  const client = io(location.origin, { transports: ['websocket'], upgrade: false, reconnection: false })
  client.on('connect', () => { document.body.dataset.stage = 'connected'; client.emit('test.request', 'verified') })
  client.on('test.response', (message) => {
    document.body.dataset.result = JSON.stringify(message)
    client.disconnect()
    worker.stop()
  })
  client.on('connect_error', (error) => { document.body.dataset.error = error.message })
} catch (error) {
  document.body.dataset.error = String(error)
}
