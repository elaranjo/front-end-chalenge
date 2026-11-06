import { expect, test } from '@playwright/test'

test('profile rejects a truncated image and stores a decoded image', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const result = await page.evaluate(async () => {
    const loginResponse = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'colecionador.a@kurio.test', password: 'DemoA!2026' }) })
    const login = await loginResponse.json()
    const headers = { Authorization: `Bearer ${login.token}`, 'If-Match': String(login.profile.version) }
    const fields = { displayName: 'Atualizado', username: login.profile.username, email: login.profile.email, ensName: '', walletNickname: '' }
    const makeForm = (avatar: Blob) => {
      const form = new FormData()
      form.set('fields', JSON.stringify(fields))
      form.set('avatar', avatar, 'avatar.png')
      return form
    }
    const truncated = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
    const rejected = await fetch('/api/v1/profile', { method: 'PUT', headers, body: makeForm(truncated) })
    const before = await fetch('/api/v1/profile', { headers })
    const canvas = document.createElement('canvas')
    canvas.width = 2; canvas.height = 2
    canvas.getContext('2d')!.fillRect(0, 0, 2, 2)
    const valid = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/png'))
    const saved = await fetch('/api/v1/profile', { method: 'PUT', headers, body: makeForm(valid) })
    const avatar = await fetch('/api/v1/profile/avatar', { headers })
    return { rejected: rejected.status, before: (await before.json()).displayName, original: login.profile.displayName, saved: saved.status, avatar: avatar.status, type: avatar.headers.get('content-type') }
  })
  expect(result.rejected).toBe(422)
  expect(result.before).toBe(result.original)
  expect(result.saved).toBe(200)
  expect(result.avatar).toBe(200)
  expect(result.type).toBe('image/png')
})
