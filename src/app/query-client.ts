import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { StaleCatalogResponse } from '../shared/catalog-client.ts'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      retry: (count, error) => count < 2 && (error instanceof StaleCatalogResponse || (axios.isAxiosError(error) && !axios.isCancel(error) && (!error.response || error.response.status >= 500))),
      retryDelay: (attempt) => 250 * (2 ** attempt),
    },
    mutations: { retry: false },
  },
})
