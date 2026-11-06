import { delay, http, HttpResponse } from 'msw'

/** Control endpoints bypass faults and latency so an evaluator can always reset. */
export function scenarioNetworkHandlers(database: IDBDatabase) {
  return [http.all('*/api/v1/*', async ({ request }) => {
    const path = new URL(request.url).pathname
    if (path.startsWith('/api/v1/__mock/')) return
    const state = await new Promise<{ name: string; sequence: number; cartReadFailure: boolean }>((resolve, reject) => {
      const tx = database.transaction('scenario', 'readwrite')
      const store = tx.objectStore('scenario')
      const config = store.get('scenario-config')
      const cartFault = store.get('cart-read-failure')
      let result: { name: string; sequence: number; cartReadFailure: boolean }
      config.onsuccess = () => {
        const name = config.result?.name ?? 'default'
        let sequence = config.result?.catalogRequests ?? 0
        if (name === 'out-of-order' && request.method === 'GET' && path === '/api/v1/nfts') {
          sequence++
          store.put({ ...config.result, catalogRequests: sequence })
        }
        result = { name, sequence, cartReadFailure: false }
      }
      cartFault.onsuccess = () => { result.cartReadFailure = cartFault.result?.enabled === true }
      tx.oncomplete = () => resolve(result)
      tx.onabort = () => reject(tx.error ?? new Error('Scenario read failed'))
    })
    const latency = state.name === 'slow' ? 2000 : state.name === 'out-of-order' && request.method === 'GET' && path === '/api/v1/nfts' ? (state.sequence === 1 ? 800 : 100) : 200
    await delay(latency)
    if (state.name === 'network-error') return HttpResponse.error()
    const match = /^http-(400|401|403|404|409|422|500|503)$/.exec(state.name)
    const status = state.cartReadFailure && path === '/api/v1/cart' && request.method === 'GET' ? 503
      : match ? Number(match[1])
      : state.name === 'favorite-failure' && path.startsWith('/api/v1/favorites/') && request.method !== 'GET' ? 503
      : state.name === 'signup-conflict' && path === '/api/v1/auth/signup' ? 409
      : state.name === 'session-expired' && request.headers.has('Authorization') ? 401
      : state.name === 'coupon-invalid' && path === '/api/v1/cart/coupon' && request.method === 'PUT' ? 422
      : state.name === 'validation-errors' && ['POST', 'PUT', 'PATCH'].includes(request.method) && !path.startsWith('/api/v1/auth/login') ? 422
      : undefined
    const field = path === '/api/v1/auth/signup' ? 'username' : path.startsWith('/api/v1/wallets/') ? 'address' : path === '/api/v1/profile' ? 'displayName' : undefined
    const code = state.name === 'signup-conflict' ? 'ACCOUNT_CONFLICT' : state.name === 'session-expired' ? 'SESSION_EXPIRED' : state.name === 'coupon-invalid' ? 'COUPON_INVALID' : state.name === 'validation-errors' ? 'VALIDATION' : `SCENARIO_${status}`
    if (status) return HttpResponse.json({ error: { code, message: 'Falha simulada', retryable: status >= 500, ...(state.name === 'validation-errors' && field ? { fieldErrors: { [field]: 'Valor inválido' } } : {}) }, requestId: crypto.randomUUID() }, { status })
  })]
}
