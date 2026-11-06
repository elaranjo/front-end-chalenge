import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { hashPassword, verifyPassword } from '../src/mocks/password.ts'
import { SEED_USERS } from '../src/mocks/user-seed.ts'

test('fictitious seed credentials verify without storing plaintext', async () => {
  assert.equal(await verifyPassword('DemoA!2026', SEED_USERS[0].passwordHash), true)
  assert.equal(await verifyPassword('DemoB!2026', SEED_USERS[1].passwordHash), true)
  assert.equal(await verifyPassword('wrong', SEED_USERS[0].passwordHash), false)
  assert.equal(JSON.stringify(SEED_USERS).includes('DemoA!2026'), false)
})

test('new passwords receive random salt and invalid records are rejected', async () => {
  const [first, second] = await Promise.all([hashPassword('sample'), hashPassword('sample')])
  assert.notEqual(first.salt, second.salt)
  assert.equal(await verifyPassword('sample', first), true)
  assert.equal(await verifyPassword('other', first), false)
  await assert.rejects(hashPassword(''), RangeError)
  await assert.rejects(verifyPassword('sample', { ...first, hash: 'invalid' }), TypeError)
})
