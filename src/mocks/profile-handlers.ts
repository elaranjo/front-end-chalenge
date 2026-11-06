import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { readSession } from './auth-handlers.ts'
import { hashPassword, verifyPassword, type PasswordHash } from './password.ts'
import type { Profile } from '../shared/contracts.ts'
import type { MockNow } from './mock-clock.ts'

const fieldsSchema = z.object({
  displayName: z.string().trim().min(1), username: z.string().trim().min(1),
  email: z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase()),
  ensName: z.string().trim().regex(/^(?:[a-zA-Z0-9-]+)?$/), walletNickname: z.string().trim(),
  avatar: z.null().optional(),
  passwordChange: z.object({ current: z.string(), new: z.string(), confirmation: z.string() }).optional(),
})
type User = { id: string; username: string; email: string; passwordHash: PasswordHash; version: number }
const fail = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) => HttpResponse.json({ error: { code, message, retryable: false, ...(fieldErrors ? { fieldErrors } : {}) }, requestId: crypto.randomUUID() }, { status })
const bearer = (request: Request) => /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? ''

async function decodeImage(file: Blob): Promise<boolean> {
  if (typeof createImageBitmap !== 'function') return false
  try {
    const image = await createImageBitmap(file)
    const valid = image.width > 0 && image.height > 0
    image.close()
    return valid
  } catch { return false }
}

async function validImage(file: Blob, decode: (file: Blob) => Promise<boolean>): Promise<boolean> {
  if (file.size > 2 * 1024 * 1024) return false
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const signature = file.type === 'image/png' ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    : file.type === 'image/jpeg' ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === 'image/webp' && bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return signature && await decode(file)
}

export function profileHandlers(database: IDBDatabase, now: MockNow = Date.now, decode: (file: Blob) => Promise<boolean> = decodeImage) {
  return [
    http.get('*/api/v1/profile', async ({ request }) => {
      const session = await readSession(database, bearer(request), await now())
      return session ? HttpResponse.json(session.profile) : fail(401, 'SESSION_INVALID', 'Autenticação necessária')
    }),
    http.get('*/api/v1/profile/avatar', async ({ request }) => {
      const session = await readSession(database, bearer(request), await now())
      if (!session) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      const readTime = await now()
      const avatar = await new Promise<{ authorized: boolean; blob?: Blob }>((resolve, reject) => {
        const tx = database.transaction(['avatars', 'sessions'], 'readonly')
        const result = tx.objectStore('avatars').get(session.session.userId)
        const current = tx.objectStore('sessions').get(session.session.id)
        tx.oncomplete = () => resolve({ authorized: !!current.result && current.result.userId === session.session.userId && current.result.sessionId === session.session.sessionId && Date.parse(current.result.expiresAt) > readTime, blob: result.result?.blob })
        tx.onabort = () => reject(tx.error)
      })
      if (!avatar.authorized) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      return avatar.blob ? new HttpResponse(avatar.blob, { headers: { 'Content-Type': avatar.blob.type, 'Cache-Control': 'no-store' } }) : fail(404, 'AVATAR_NOT_FOUND', 'Avatar não encontrado')
    }),
    http.put('*/api/v1/profile', async ({ request }) => {
      const token = bearer(request)
      const session = await readSession(database, token, await now())
      if (!session) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      const revision = request.headers.get('If-Match')
      if (revision === null || !/^(0|[1-9]\d*)$/.test(revision) || !Number.isSafeInteger(Number(revision))) return fail(400, 'MISSING_PRECONDITION', 'Revisão obrigatória')
      const form = await request.formData().catch(() => null)
      if (!form) return fail(400, 'MALFORMED_FORM', 'Requisição ilegível')
      const raw = form?.get('fields')
      let value: unknown
      try { value = typeof raw === 'string' ? JSON.parse(raw) : null } catch { return fail(400, 'MALFORMED_JSON', 'Requisição ilegível') }
      const input = fieldsSchema.safeParse(value)
      if (!input.success) return fail(422, 'VALIDATION', 'Verifique os campos', Object.fromEntries(input.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      const avatar = form?.get('avatar')
      if (avatar !== null && avatar !== undefined && (!(avatar instanceof Blob) || !await validImage(avatar, decode))) return fail(422, 'VALIDATION', 'Arquivo inválido', { avatar: 'Use PNG, JPEG ou WebP de até 2 MiB' })
      const change = input.data.passwordChange
      const changing = !!change && Object.values(change).some(Boolean)
      if (changing && (!change.current || !change.new || !change.confirmation || change.new !== change.confirmation)) return fail(422, 'VALIDATION', 'Verifique a senha', { passwordChange: 'Preencha os três campos e confirme a nova senha' })
      const user = await new Promise<User | undefined>((resolve, reject) => {
        const tx = database.transaction('users', 'readonly')
        const result = tx.objectStore('users').get(session.session.userId)
        tx.oncomplete = () => resolve(result.result)
        tx.onabort = () => reject(tx.error)
      })
      if (!user) return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      if (changing && !await verifyPassword(change.current, user.passwordHash)) return fail(422, 'VALIDATION', 'Senha atual incorreta', { currentPassword: 'Senha atual incorreta' })
      const passwordHash = changing ? await hashPassword(change.new) : user.passwordHash
      const commitTime = await now()
      const outcome = await new Promise<{ status: string; profile?: Profile }>((resolve, reject) => {
        const tx = database.transaction(['users', 'profiles', 'avatars', 'sessions'], 'readwrite')
        const users = tx.objectStore('users').getAll()
        const profile = tx.objectStore('profiles').get(user.id)
        const currentSession = tx.objectStore('sessions').get(token)
        let result: { status: string; profile?: Profile } = { status: 'conflict' }
        let count = 0
        const ready = () => {
          if (++count !== 3) return
          const current = (users.result as User[]).find((item) => item.id === user.id)
          if (!currentSession.result || Date.parse(currentSession.result.expiresAt) <= commitTime) { result = { status: 'unauthorized' }; return }
          if (!current || current.version !== user.version || !profile.result || profile.result.version !== Number(revision)) return
          if ((users.result as User[]).some((item) => item.id !== user.id && (item.email.toLowerCase() === input.data.email || item.username.toLowerCase() === input.data.username.toLowerCase()))) { result = { status: 'duplicate' }; return }
          const { passwordChange: _passwordChange, avatar: removeAvatar, ...fields } = input.data
          const newProfile = { ...profile.result, ...fields, avatarUrl: avatar instanceof Blob ? '/api/v1/profile/avatar' : removeAvatar === null ? null : profile.result.avatarUrl, version: profile.result.version + 1 }
          tx.objectStore('users').put({ ...current, username: fields.username, email: fields.email, passwordHash, version: current.version + 1 })
          tx.objectStore('profiles').put(newProfile)
          if (avatar instanceof Blob) tx.objectStore('avatars').put({ id: user.id, blob: avatar })
          else if (removeAvatar === null) tx.objectStore('avatars').delete(user.id)
          result = { status: 'ok', profile: newProfile }
        }
        users.onsuccess = ready
        profile.onsuccess = ready
        currentSession.onsuccess = ready
        tx.oncomplete = () => resolve(result)
        tx.onabort = () => reject(tx.error)
      })
      if (outcome.status === 'unauthorized') return fail(401, 'SESSION_INVALID', 'Autenticação necessária')
      if (outcome.status === 'duplicate') return fail(409, 'ACCOUNT_CONFLICT', 'E-mail ou nome de usuário já cadastrado')
      if (outcome.status !== 'ok') return fail(409, 'REVISION_CONFLICT', 'Perfil alterado; recarregue os dados')
      return HttpResponse.json(outcome.profile)
    }),
  ]
}
