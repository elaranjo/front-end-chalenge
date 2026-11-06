import type { AxiosInstance } from 'axios'
import type { QueryClient } from '@tanstack/react-query'
import { profileSchema, type Profile } from './contracts.ts'
import type { SessionManager } from './session.ts'
import type { EventGate } from '../realtime/event-gate.ts'

export type ProfileChanges = {
  displayName: string; username: string; email: string; ensName: string; walletNickname: string
  passwordChange?: { current: string; new: string; confirmation: string }
}

/** Avatar and fields are staged in memory and submitted in one request. */
export class ProfileClient {
  private readonly http: AxiosInstance
  private readonly queries: QueryClient
  private readonly sessions: SessionManager
  private readonly getGate: () => EventGate | null
  constructor(http: AxiosInstance, queries: QueryClient, sessions: SessionManager, getGate: () => EventGate | null) {
    this.http = http; this.queries = queries; this.sessions = sessions; this.getGate = getGate
  }

  async avatar(signal?: AbortSignal): Promise<Blob> {
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    const generation = this.sessions.sessionGeneration
    const response = await this.http.get('/profile/avatar', { responseType: 'blob', signal, headers: { Authorization: `Bearer ${session.token}` } })
    if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token || this.sessions.session.userId !== session.userId) throw new Error('Session changed')
    if (!(response.data instanceof Blob) || !['image/png', 'image/jpeg', 'image/webp'].includes(response.data.type)) throw new Error('Invalid avatar response')
    return response.data
  }

  async save(fields: ProfileChanges, revision: number, avatar?: Blob | null): Promise<Profile> {
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    if (!Number.isSafeInteger(revision) || revision < 0) throw new RangeError('Invalid profile revision')
    const generation = this.sessions.sessionGeneration
    const gate = this.getGate()
    if (!gate) throw new Error('Realtime state is not ready')
    const isCurrent = () => this.sessions.sessionGeneration === generation && this.sessions.session?.token === session.token && this.getGate() === gate
    const key = ['profile', session.userId, generation] as const
    await this.queries.cancelQueries({ queryKey: key, exact: true })
    if (!isCurrent()) throw new Error('Session changed')
    const body = new FormData()
    body.set('fields', JSON.stringify({ ...fields, ...(avatar === null ? { avatar: null } : {}) }))
    if (avatar instanceof Blob) body.set('avatar', avatar, 'avatar')
    try {
      const response = await this.http.put('/profile', body, { headers: { Authorization: `Bearer ${session.token}`, 'If-Match': String(revision) } })
      if (!isCurrent()) throw new Error('Session changed')
      const profile = profileSchema.parse(response.data)
      if (profile.id !== session.userId || !gate.observePrivate('profile', session.userId, profile.version)) throw new Error('Stale profile response')
      this.queries.setQueryData(key, profile)
      return profile
    } catch (error) {
      if (isCurrent()) void this.queries.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' })
      throw error
    }
  }
}
