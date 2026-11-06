const key = 'kurio.auth-favorite-focus'
type FavoriteFocus = { id: string; detail: boolean; source: string; restore: boolean }

function read(): FavoriteFocus | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (value && typeof value === 'object' && 'id' in value && 'detail' in value && 'source' in value && 'restore' in value && typeof value.id === 'string' && typeof value.detail === 'boolean' && typeof value.source === 'string' && typeof value.restore === 'boolean') return value as FavoriteFocus
  } catch { /* Ignore an invalid, stale marker. */ }
  return null
}

export function rememberFavoriteFocus(id: string, detail: boolean, source: string) {
  sessionStorage.setItem(key, JSON.stringify({ id, detail, source, restore: false }))
}

export function prepareFavoriteFocus(destination: string) {
  const value = read()
  if (value && value.source === destination) sessionStorage.setItem(key, JSON.stringify({ ...value, restore: true }))
  else sessionStorage.removeItem(key)
}

export function takeFavoriteFocus(id: string, detail: boolean, source: string): boolean {
  const value = read()
  if (!value?.restore || value.id !== id || value.detail !== detail || value.source !== source) return false
  sessionStorage.removeItem(key)
  return true
}

export function clearFavoriteFocus() { sessionStorage.removeItem(key) }
