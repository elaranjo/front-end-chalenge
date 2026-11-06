import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { readJson } from './read-json.ts'
import { hashPassword, verifyPassword, type PasswordHash } from './password.ts'
import { SEED_USERS } from './user-seed.ts'
import type { MockNow } from './mock-clock.ts'

type User = { id: string; username: string; email: string; passwordHash: PasswordHash; version: number }
type Profile = { id: string; displayName: string; username: string; email: string; ensName: string; walletNickname: string; avatarUrl: string | null; version: number }
type StoredSession = { id: string; sessionId: string; userId: string; expiresAt: string }
const signupSchema = z.object({ username: z.string().trim().min(1), email: z.email().transform((v) => v.trim().toLowerCase()), password: z.string().min(1), passwordConfirmation: z.string() }).refine((v) => v.password === v.passwordConfirmation, { path: ['passwordConfirmation'], message: 'As senhas não coincidem' })
const loginSchema = z.object({ email: z.email().transform((v) => v.trim().toLowerCase()), password: z.string().min(1) })
export const profileFor = (user: User): Profile => ({ id: user.id, displayName: user.username, username: user.username, email: user.email, ensName: '', walletNickname: '', avatarUrl: null, version: 1 })
const error = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) => HttpResponse.json({ error: { code, message, retryable: false, ...(fieldErrors ? { fieldErrors } : {}) }, requestId: crypto.randomUUID() }, { status })
const sessionFor = (userId: string, now: number): StoredSession => ({ id: crypto.randomUUID(), sessionId: crypto.randomUUID(), userId, expiresAt: new Date(now + 30 * 60_000).toISOString() })
const output = (session: StoredSession, profile: Profile) => ({ token: session.id, sessionId: session.sessionId, userId: session.userId, expiresAt: session.expiresAt, profile })

export async function initializeAccounts(database: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['scenario', 'users', 'profiles'], 'readwrite')
    const marker = tx.objectStore('scenario').get('accounts-meta')
    marker.onsuccess = () => {
      if (!marker.result) {
        for (const user of SEED_USERS) {
          tx.objectStore('users').add(user)
          tx.objectStore('profiles').add(profileFor(user))
        }
        tx.objectStore('scenario').add({ id: 'accounts-meta', version: 1 })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('Account initialization failed'))
  })
}

async function findUser(database: IDBDatabase, email: string): Promise<User | undefined> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('users', 'readonly')
    const request = tx.objectStore('users').getAll()
    tx.oncomplete = () => resolve((request.result as User[]).find((user) => user.email.toLowerCase() === email))
    tx.onabort = () => reject(tx.error)
  })
}

export async function readSession(database: IDBDatabase, token: string, now: number): Promise<{ session: StoredSession; profile: Profile } | undefined> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['sessions', 'profiles'], 'readonly')
    const request = tx.objectStore('sessions').get(token)
    let profile: IDBRequest | undefined
    request.onsuccess = () => {
      const session = request.result as StoredSession | undefined
      if (session && Date.parse(session.expiresAt) > now) profile = tx.objectStore('profiles').get(session.userId)
    }
    tx.oncomplete = () => resolve(request.result && profile?.result ? { session: request.result, profile: profile.result } : undefined)
    tx.onabort = () => reject(tx.error)
  })
}

function bearer(request: Request): string {
  return /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? ''
}

export function authHandlers(database: IDBDatabase, now: MockNow = Date.now) {
  return [
    http.post('*/api/v1/auth/signup', async ({ request }) => {
      const body = await readJson(request)
      if (!body.ok) return error(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const input = signupSchema.safeParse(body.value)
      if (!input.success) return error(422, 'VALIDATION', 'Verifique os campos', Object.fromEntries(input.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      const passwordHash = await hashPassword(input.data.password)
      const user: User = { id: crypto.randomUUID(), username: input.data.username, email: input.data.email, passwordHash, version: 1 }
      const profile = profileFor(user)
      const session = sessionFor(user.id, await now())
      const conflicts = await new Promise<Record<string, string>>((resolve, reject) => {
        const tx = database.transaction(['users', 'profiles', 'sessions'], 'readwrite')
        const requestUsers = tx.objectStore('users').getAll()
        const fields: Record<string, string> = {}
        requestUsers.onsuccess = () => {
          const users = requestUsers.result as User[]
          if (users.some((existing) => existing.email.toLowerCase() === user.email)) fields.email = 'E-mail já cadastrado'
          if (users.some((existing) => existing.username.toLowerCase() === user.username.toLowerCase())) fields.username = 'Nome de usuário já cadastrado'
          if (!Object.keys(fields).length) {
            tx.objectStore('users').add(user)
            tx.objectStore('profiles').add(profile)
            tx.objectStore('sessions').add(session)
          }
        }
        tx.oncomplete = () => resolve(fields)
        tx.onabort = () => reject(tx.error)
      })
      return Object.keys(conflicts).length ? error(409, 'ACCOUNT_CONFLICT', 'E-mail ou nome de usuário já cadastrado', conflicts) : HttpResponse.json(output(session, profile), { status: 201 })
    }),
    http.post('*/api/v1/auth/login', async ({ request }) => {
      const body = await readJson(request)
      if (!body.ok) return error(400, 'MALFORMED_JSON', 'Requisição ilegível')
      const input = loginSchema.safeParse(body.value)
      if (!input.success) return error(422, 'VALIDATION', 'Verifique os campos')
      const user = await findUser(database, input.data.email)
      if (!user || !(await verifyPassword(input.data.password, user.passwordHash))) return error(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos')
      const session = sessionFor(user.id, await now())
      const profile = await new Promise<Profile | undefined>((resolve, reject) => {
        const tx = database.transaction(['users', 'profiles', 'sessions'], 'readwrite')
        const current = tx.objectStore('users').get(user.id)
        const savedProfile = tx.objectStore('profiles').get(user.id)
        current.onsuccess = () => {
          if (current.result?.version === user.version) tx.objectStore('sessions').add(session)
        }
        tx.oncomplete = () => resolve(current.result?.version === user.version ? savedProfile.result : undefined)
        tx.onabort = () => reject(tx.error)
      })
      return profile ? HttpResponse.json(output(session, profile)) : error(409, 'ACCOUNT_CHANGED', 'Conta alterada; tente novamente')
    }),
    http.get('*/api/v1/auth/session', async ({ request }) => {
      const result = await readSession(database, bearer(request), await now())
      return result ? HttpResponse.json(output(result.session, result.profile)) : error(401, 'SESSION_EXPIRED', 'Sessão inválida ou expirada')
    }),
    http.post('*/api/v1/auth/logout', async ({ request }) => {
      const token = bearer(request)
      const authenticated = await readSession(database, token, await now())
      if (!authenticated) return error(401, 'SESSION_EXPIRED', 'Sessão inválida ou expirada')
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(['sessions', 'scenario'], 'readwrite')
        tx.objectStore('sessions').delete(token)
        const scenario = tx.objectStore('scenario')
        const connection = scenario.get(`connection:${authenticated.session.userId}`)
        connection.onsuccess = () => {
          if (connection.result?.sessionId === authenticated.session.sessionId && connection.result.status === 'connected') scenario.put({ ...connection.result, status: 'disconnected', version: connection.result.version + 1 })
        }
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error)
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
