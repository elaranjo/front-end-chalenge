import type { PasswordHash } from './password.ts'

/** Hashes are precomputed for the two public fictitious demo credentials. */
export const SEED_USERS: readonly { id: string; username: string; email: string; passwordHash: PasswordHash; version: number }[] = [
  {
    id: 'collector-a', username: 'colecionador.a', email: 'colecionador.a@kurio.test', version: 1,
    passwordHash: { algorithm: 'PBKDF2-SHA256', iterations: 600_000, salt: '00112233445566778899aabbccddeeff', hash: '688643d0952a90c520fabb48073844e31d3b56ff2ec691843c30f85986de6dfc' },
  },
  {
    id: 'collector-b', username: 'colecionador.b', email: 'colecionador.b@kurio.test', version: 1,
    passwordHash: { algorithm: 'PBKDF2-SHA256', iterations: 600_000, salt: 'ffeeddccbbaa99887766554433221100', hash: 'fb32a34db214c412094c7ef4eadcbb4b8bf23343784974b0488fa75c7a46ef3c' },
  },
]
