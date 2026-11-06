import type { AxiosInstance } from 'axios'
import type { QueryClient } from '@tanstack/react-query'
import { walletConnectionSchema, walletSchema, type Wallet } from './contracts.ts'
import type { SessionManager } from './session.ts'

export type WalletInput = Omit<Wallet, 'id' | 'slot' | 'version'>
type Selection = { walletId: string; provider: Wallet['type']; network: Wallet['network'] }

/** Network operations are never retried automatically after an ambiguous failure. */
export class WalletClient {
  private readonly http: AxiosInstance
  private readonly queries: QueryClient
  private readonly sessions: SessionManager
  constructor(http: AxiosInstance, queries: QueryClient, sessions: SessionManager) {
    this.http = http; this.queries = queries; this.sessions = sessions
  }

  private identity() {
    const session = this.sessions.session
    if (!session) throw new Error('Authentication required')
    const generation = this.sessions.sessionGeneration
    const verify = () => {
      if (this.sessions.sessionGeneration !== generation || this.sessions.session?.token !== session.token || this.sessions.session.userId !== session.userId) throw new Error('Session changed')
    }
    return { session, generation, verify }
  }

  async save(slot: Wallet['slot'], fields: WalletInput, revision: number): Promise<Wallet> {
    if (!Number.isSafeInteger(revision) || revision < 0) throw new RangeError('Invalid wallet revision')
    const { session, generation, verify } = this.identity()
    const key = ['wallets', session.userId, generation] as const
    await this.queries.cancelQueries({ queryKey: key, exact: true })
    verify()
    try {
      const response = await this.http.put(`/wallets/${slot}`, fields, { headers: { Authorization: `Bearer ${session.token}`, 'If-Match': String(revision) } })
      verify()
      const wallet = walletSchema.parse(response.data)
      if (wallet.slot !== slot || wallet.version <= revision) throw new Error('Invalid wallet response')
      await this.queries.invalidateQueries({ queryKey: key, exact: true })
      verify()
      return wallet
    } catch (error) {
      if (this.sessions.sessionGeneration === generation && this.sessions.session?.token === session.token) void this.queries.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' })
      throw error
    }
  }

  async connect(selection: Selection) {
    const { session, verify } = this.identity()
    const response = await this.http.post('/wallet-connections', selection, { headers: { Authorization: `Bearer ${session.token}` } })
    verify()
    const connection = walletConnectionSchema.parse(response.data)
    if (connection.walletId !== selection.walletId || connection.provider !== selection.provider || connection.network !== selection.network) throw new Error('Invalid connection response')
    return connection
  }

  async disconnect(id: string): Promise<void> {
    if (!id) throw new Error('Connection required')
    const { session, verify } = this.identity()
    await this.http.delete(`/wallet-connections/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${session.token}` } })
    verify()
  }
}
