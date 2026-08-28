/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two helpers every admin invitation route shares: the authorization guard
 * and the accept-link base URL.
 *
 * Extracted into their own module so the issue/accept routes and the
 * lifecycle (list/resend/revoke) routes can both reach them WITHOUT importing
 * each other — the two route modules would otherwise form an import cycle.
 * Keeping the guard in one place is the point: every endpoint on the invitation
 * surface must deny identically, or the ones that deny differently become the
 * probe that reveals the rest.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { Context } from 'hono'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

export interface SessionLike {
  readonly user: { readonly id: string; readonly name?: string }
  readonly session: { readonly userId: string }
}

/**
 * Compute the absolute base URL for the current request.
 *
 * Priority order:
 *   1. The configured `BASE_URL` environment variable (production / when set).
 *   2. The request origin from the `Origin` / `Referer` header.
 *   3. A best-effort reconstruction from `Host` + `X-Forwarded-Proto`.
 *
 * Tests run on `http://localhost:<random-port>` and the request's `Origin`
 * header carries that port, so the returned URL stays in-host with the
 * test server.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
export const resolveBaseURL = (c: Context): string => {
  const envUrl = process.env['BASE_URL']
  if (envUrl) return envUrl.replace(/\/$/, '')

  const origin = c.req.header('origin')
  if (origin) return origin.replace(/\/$/, '')

  const referer = c.req.header('referer')
  if (referer) {
    try {
      const u = new URL(referer)
      return `${u.protocol}//${u.host}`
    } catch {
      // fall through
    }
  }

  const host = c.req.header('host') ?? 'localhost'
  const proto = c.req.header('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/**
 * Resolve the admin caller's session and verify their role is admin-EQUIVALENT
 * for this app (`isAdminEquivalent`: the resolved top role ∪ the built-in
 * `admin`) — the same predicate `applyAdminRoleCheckMiddleware` applies to the
 * rest of `/api/auth/admin/*`. Reading the strict literal `role === 'admin'`
 * here 404ed (via that middleware) the very operator an app designated.
 *
 * The denial is **404**, never 403. The previous 403 was unreachable only
 * because the middleware 404ed first; the moment that middleware widened, a 403
 * from here would have confirmed the endpoint's existence to every
 * non-admin-equivalent caller — an S1 anti-enumeration regression introduced BY
 * the alignment. Both guards move together, and both deny identically.
 *
 * Returns the JSON Response when authorization fails (401 anonymous / 404
 * non-admin). Returns the authenticated session when successful so the handler
 * has access to the inviter's display name.
 */
export const requireAdminCaller = async (
  authInstance: AuthInstance,
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
  c: Context,
  app: Readonly<App> | undefined
): Promise<{ readonly session: SessionLike } | Response> => {
  const callerSession = (await authInstance.api.getSession({
    headers: c.req.raw.headers,
  })) as SessionLike | null

  if (!callerSession) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const role = await getUserRole(callerSession.session.userId)
  if (role === undefined || !isAdminEquivalent(role, app ?? {})) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  return { session: callerSession }
}
