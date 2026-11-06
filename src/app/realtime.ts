import { createSocket } from '../realtime/socket.ts'
import { RealtimeRuntime } from '../realtime/runtime.ts'
import { queryClient } from './query-client.ts'
import { sessionManager } from './session.ts'

export const realtime = new RealtimeRuntime(sessionManager, queryClient, window.localStorage, () => createSocket(window.location.origin), (error) => { console.error('Falha na sincronização em tempo real', error) })
