import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from './app/query-client.ts'
import { router } from './app/router.tsx'
import { sessionManager } from './app/session.ts'
import { clearClientForMockReset } from './shared/mock-reset-client.ts'
import { onMockReset } from './shared/reset-signal.ts'
import { setAccountQueryGate } from './app/private-queries.ts'
import { setCatalogQueryGate, setCatalogReadiness } from './app/catalog-queries.ts'
import { setCartQueryGate } from './app/cart-queries.ts'
import { setFavoritesQueryGate } from './app/favorites.ts'
import axios from 'axios'
import '@fontsource-variable/roboto-mono'
import './index.css'

const root = createRoot(document.getElementById('root')!)

async function start() {
  try {
    if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
      onMockReset((generation) => { void clearClientForMockReset(sessionManager, queryClient, window.localStorage, generation) })
      const { startMocks } = await import('./mocks/browser.ts')
      await startMocks()
    }
    try {
      await sessionManager.restore()
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error
    }
    // Import the Socket.IO client only after MSW installs its WebSocket interceptor.
    const { realtime } = await import('./app/realtime.ts')
    setAccountQueryGate(() => realtime.currentGate)
    setCatalogQueryGate(() => realtime.currentGate)
    setCatalogReadiness(() => realtime.isReady, (listener) => realtime.subscribe(listener), () => realtime.revision)
    setCartQueryGate(() => realtime.currentGate)
    setFavoritesQueryGate(() => realtime.currentGate)
    realtime.start()
    root.render(<StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></StrictMode>)
  } catch {
    root.render(<main role="alert"><p>Não foi possível iniciar a aplicação.</p><button onClick={() => location.reload()}>Tentar novamente</button></main>)
  }
}

void start()
