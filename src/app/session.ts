import axios from 'axios'
import { api } from '../shared/http.ts'
import { SessionManager } from '../shared/session.ts'
import { queryClient } from './query-client.ts'
import { AuthFlow } from '../shared/auth-flow.ts'

export const sessionManager = new SessionManager(api, queryClient, window.localStorage)
export const authFlow = new AuthFlow(sessionManager, api, window.localStorage)

/** Clear local private state immediately, and surface an unconfirmed remote logout. */
export async function logoutWithFeedback(navigate: () => Promise<unknown>) {
  const pending = sessionManager.logout()
  const generation = sessionManager.sessionGeneration
  let remoteFailed = false
  try { await pending } catch { remoteFailed = true }
  // A late response must not redirect or warn a newly authenticated user.
  if (sessionManager.sessionGeneration !== generation || sessionManager.session) return
  await navigate()
  if (remoteFailed && sessionManager.sessionGeneration === generation && !sessionManager.session) {
    window.dispatchEvent(new Event('kurio:logout-unconfirmed'))
  }
}

api.interceptors.request.use((config) => {
  const token = sessionManager.session?.token
  if (token && !config.headers.has('Authorization')) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const path = error.config?.url ?? ''
    const requestToken = error.config?.headers?.get?.('Authorization')
    const currentToken = sessionManager.session?.token
    if (!path.startsWith('/auth/') && currentToken && requestToken === `Bearer ${currentToken}`) {
      await sessionManager.clear()
    }
  }
  return Promise.reject(error)
})

window.addEventListener('storage', (event) => {
  if (event.key === 'kurio.session-token' && event.newValue !== sessionManager.session?.token) {
    // The new token belongs to a different session; do not adopt another tab's data silently.
    void sessionManager.clearForExternalChange()
  }
})
