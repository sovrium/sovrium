/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared client-side session resolver (GDPR-conversion foundation).
 *
 * The one place a client surface resolves the SIGNED-IN caller's OWN session
 * field — fetched CLIENT-SIDE from `GET /api/auth/get-session`, never
 * server-rendered or cached across users. Two cooperating surfaces consume it:
 *
 *  1. Session-bound `text` (`presentation/client.ts` `setupSessionBoundText`):
 *     a `data-session-template` element's `$session.<field>` token is resolved
 *     into the caller's own value — "logged in as X". An anonymous caller
 *     resolves to the EMPTY string (the security invariant — no identity leaks,
 *     no static cross-user value).
 *  2. The type-to-confirm confirm gate (the vanilla-DOM `client.ts` gate and the
 *     React `inline-confirm-dialog.tsx`): the gate's `matchValue` (e.g.
 *     `$session.email`) is resolved so the confirm affordance stays disabled
 *     until the caller retypes their OWN email.
 *
 * The resolvable fields are deliberately limited to the non-sensitive identity
 * fields the session envelope returns (`email` / `name` / `role` / `id`) — every
 * value is the CALLER's own, mirroring `SessionFieldSchema`.
 */

/** The signed-in caller's OWN session identity (the `{ user }` envelope subset). */
export interface SessionUser {
  readonly email?: string
  readonly name?: string
  readonly role?: string
  readonly id?: string
}

/** The `$session.<field>` interpolation token. */
const SESSION_TOKEN_PATTERN = /\$session\.(\w+)/g

/**
 * Fetch the signed-in caller's OWN session identity from
 * `GET /api/auth/get-session`. Returns `undefined` for an anonymous caller (no
 * session, a non-2xx response, or a network failure) so the consumer resolves
 * every `$session.<field>` token to the empty string — the anon-safe path.
 */
export async function fetchSessionUser(): Promise<SessionUser | undefined> {
  if (typeof fetch === 'undefined') return undefined
  try {
    const res = await fetch('/api/auth/get-session', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    if (!res.ok) return undefined
    const body = (await res.json().catch(() => undefined)) as
      { readonly user?: SessionUser } | undefined
    return body?.user ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve every `$session.<field>` token in `template` against the caller's own
 * session. A missing field, or an anonymous caller (`user` is `undefined`),
 * resolves the token to the EMPTY string so no identity is fabricated or leaked.
 */
export function resolveSessionTemplate(template: string, user: SessionUser | undefined): string {
  if (!template.includes('$session.')) return template
  return template.replaceAll(SESSION_TOKEN_PATTERN, (_full, field: string) => {
    const value = user ? (user as Record<string, unknown>)[field] : undefined
    return value === undefined || value === null ? '' : String(value)
  })
}
