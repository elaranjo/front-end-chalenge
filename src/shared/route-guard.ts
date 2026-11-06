import { redirect } from '@tanstack/react-router'
import type { Session } from './contracts.ts'
import { safeReturnTo } from './safe-return.ts'

/** TanStack Router beforeLoad guard for the private destinations defined by the challenge. */
export function requireSession(session: Session | null, requestedHref: string): void {
  if (session) return
  const returnTo = safeReturnTo(requestedHref)
  throw redirect({ href: `/login?${new URLSearchParams({ returnTo }).toString()}` })
}
