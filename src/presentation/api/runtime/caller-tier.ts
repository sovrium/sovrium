/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { AdminRoleResolvable } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Who is calling, as far as an admin-only surface cares: nobody signed in, a
 * signed-in user below the dashboard tier, or an admin-tier user.
 */
export type CallerTier = 'anonymous' | 'non-admin' | 'admin'

/**
 * The one capability of the Better Auth instance this module needs. Declared
 * structurally so the runtime tier names no infrastructure type; the instance
 * `createHonoApp` builds satisfies it as-is.
 */
export interface SessionReader {
  readonly api: {
    getSession(input: { readonly headers: Headers }): Promise<unknown>
  }
}

/**
 * Reads a user's global role. Injected rather than imported because the runtime
 * tier may not reach a use-case: each caller binds `getUserRole` itself.
 */
export type ReadUserRole = (userId: string) => Promise<string>

/**
 * The headers the session is looked up with. A `Bearer` credential is handed
 * over on its own, without its scheme; any other request passes its headers
 * through, so a session cookie and an `x-api-key` both reach Better Auth.
 */
const sessionLookupHeaders = (c: Context): Headers => {
  const authHeader = c.req.header('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? new Headers({ authorization: authHeader.slice(7) })
    : c.req.raw.headers
}

/**
 * Resolve the caller's tier — the ONE implementation behind every surface that
 * treats an admin-tier caller differently from everyone else: the OpenAPI
 * guard, which refuses anyone else, and the health endpoint, which answers
 * everyone but discloses its detail to an admin only. Sharing it is what keeps
 * the two from disagreeing about who is an admin.
 *
 * A missing, expired or unrecognised session is `anonymous`. The tier comes
 * from the canonical, custom-role-aware `isAdminTier` threaded with the `app`,
 * never from `role === 'admin'`. A failure to resolve the session or the role
 * REJECTS: each caller decides what a failure means for its own answer, and
 * both current callers treat it as "not an admin".
 */
export const resolveCallerTier = async (
  c: Context,
  auth: SessionReader,
  app: AdminRoleResolvable,
  readRole: ReadUserRole
): Promise<CallerTier> => {
  const sessionResult = (await auth.api.getSession({ headers: sessionLookupHeaders(c) })) as {
    readonly session?: { readonly userId: string }
  } | null

  if (!sessionResult?.session) return 'anonymous'

  // Lazy import: the domain barrel is kept off the import-time path, as in the
  // `/api/admin/*` guard.
  const { isAdminTier } = await import('@/domain/models/app')
  const role = await readRole(sessionResult.session.userId)

  return isAdminTier(role, app) ? 'admin' : 'non-admin'
}
