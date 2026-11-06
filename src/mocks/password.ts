const ITERATIONS = 600_000
const HASH_BYTES = 32
const SALT_BYTES = 16

export type PasswordHash = {
  algorithm: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  hash: string
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function unhex(value: string, length: number): Uint8Array {
  if (!new RegExp(`^[0-9a-f]{${length * 2}}$`).test(value)) throw new TypeError('Invalid password hash encoding')
  return Uint8Array.from(value.match(/../g)!, (pair) => Number.parseInt(pair, 16))
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations }, key, HASH_BYTES * 8)
  return new Uint8Array(bits)
}

/** Perform before opening an IndexedDB write transaction. */
export async function hashPassword(password: string): Promise<PasswordHash> {
  if (!password) throw new RangeError('Password is required')
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  return { algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: hex(salt), hash: hex(await derive(password, salt, ITERATIONS)) }
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  if (stored.algorithm !== 'PBKDF2-SHA256' || stored.iterations !== ITERATIONS) throw new TypeError('Unsupported password hash')
  const expected = unhex(stored.hash, HASH_BYTES)
  const actual = await derive(password, unhex(stored.salt, SALT_BYTES), stored.iterations)
  let difference = 0
  for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ actual[i]
  return difference === 0
}
