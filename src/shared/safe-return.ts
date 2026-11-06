/** Accept only local routes served by the application; preserve query and fragment. */
export function safeReturnTo(value: unknown, fallback: '/' | '/cart' = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return fallback
  try {
    const base = 'https://local.invalid'
    const target = new URL(value, base)
    if (target.origin !== base) return fallback
    const path = decodeURIComponent(target.pathname)
    const known = path === '/' || ['/cart', '/checkout', '/profile', '/wallets', '/favorites'].includes(path) || /^\/(?:nfts|orders)\/[^/]+$/.test(path)
    return known ? `${target.pathname}${target.search}${target.hash}` : fallback
  } catch {
    return fallback
  }
}
