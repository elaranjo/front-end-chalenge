import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isRedirect } from '@tanstack/react-router'
import { requireSession } from '../src/shared/route-guard.ts'
import type { Session } from '../src/shared/contracts.ts'

test('private routes redirect visitors to login with a safe return destination', () => {
  for (const [requested, expected] of [['/checkout?step=review', '/checkout?step=review'], ['//evil.example/path', '/']] as const) {
    try {
      requireSession(null, requested)
      assert.fail('Expected a redirect')
    } catch (error) {
      assert.equal(isRedirect(error), true)
      if (!isRedirect(error)) throw error
      const destination = new URL(error.options.href!, 'https://local.invalid')
      assert.equal(destination.pathname, '/login')
      assert.equal(destination.searchParams.get('returnTo'), expected)
    }
  }
  assert.doesNotThrow(() => requireSession({ userId: 'a' } as Session, '/checkout'))
})
