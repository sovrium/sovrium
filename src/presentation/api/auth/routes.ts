/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import {
  conflict,
  notFound,
  unauthorized,
  validationError,
} from '@/presentation/api/runtime/auth-helpers'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
import type { Context, Hono } from 'hono'

/**
 * Auth API Routes
 *
 * Provides custom auth routes that supplement Better Auth's built-in endpoints.
 * Includes security controls for role manipulation prevention.
 *
 * Note: Organization member addition is done via Better Auth's invitation flow,
 * not through a custom add-member endpoint. Test fixtures can add members
 * directly via the AuthService infrastructure layer.
 */

/**
 * Better Auth API interface
 */
interface BetterAuthAPI {
  api: {
    getSession: (context: {
      headers: Headers
    }) => Promise<{ user: unknown; session: { id: string; userId: string } } | null>
    setRole: (context: {
      headers: Headers
      body: { userId: string; role: string }
    }) => Promise<unknown>
  }
}

/**
 * Resolve and validate the Better Auth instance.
 *
 * Returns the typed auth instance, or `undefined` if the provided value is not
 * a usable Better Auth API object (caller should respond with 500).
 */
const resolveAuthInstance = (authInstance?: unknown): BetterAuthAPI | undefined => {
  if (!authInstance || typeof authInstance !== 'object' || !('api' in authInstance)) {
    return undefined
  }
  return authInstance as BetterAuthAPI
}

/**
 * POST /api/auth/session/refresh
 *
 * Confirm the caller's session is live and answer `200`.
 *
 * It mints no token and invalidates nothing: Better Auth extends a session's
 * `expiresAt` on its own when the session is read past `updateAge`, and the
 * `getSession` call below is that read. A caller without a live session gets
 * `401`.
 */
const createSessionRefreshHandler = (authInstance?: unknown) => async (c: Context) => {
  try {
    const auth = resolveAuthInstance(authInstance)
    if (!auth) {
      return c.json(
        { success: false, message: 'Auth instance not configured', code: 'SERVICE_UNAVAILABLE' },
        500
      )
    }

    // Get current session
    const currentSession = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!currentSession) {
      return unauthorized(c)
    }

    return c.json(
      {
        message: 'Session refreshed successfully',
      },
      200
    )
  } catch {
    return c.json(
      { success: false, message: 'Failed to refresh session', code: 'INTERNAL_ERROR' },
      500
    )
  }
}

/**
 * Authorize an admin caller.
 *
 * Returns a JSON Response (401/404) when authorization fails, or `undefined`
 * when the caller may proceed. The admit predicate is set-role's own —
 * `isAdminEquivalent`, the app's unrestricted role or the literal `admin` — so
 * this route and set-role admit the same people. The admin tier's other names
 * (`admin-editor`, `admin-viewer`, `operator`) are not admin-equivalent and are
 * refused here, as the admin plane refuses them.
 */
const authorizeAdminCaller = async (
  auth: BetterAuthAPI,
  c: Context,
  app: AdminRoleResolvable
): Promise<Response | undefined> => {
  const callerSession = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!callerSession) {
    return unauthorized(c)
  }

  const { getUserRole } = await import('@/application/use-cases/tables/user-role')
  const callerRole = await runDomainPromise(c, getUserRole(callerSession.session.userId))
  if (!isAdminEquivalent(callerRole, app)) {
    // S1 anti-enumeration: admin-role denial returns 404 so the existence
    // of the admin endpoint is not discoverable by non-admin callers.
    return notFound(c)
  }

  return undefined
}

/**
 * Parse and validate the role-update request (body + path parameter).
 *
 * Returns the validated inputs, or a 400 JSON Response when validation fails.
 *
 * The body read is non-throwing. A bare `await c.req.json()` here made a body
 * that is not JSON throw a `SyntaxError` which the caller's own catch relabelled
 * `500 'Failed to update user role'` — a caller's typo reported as a server
 * fault, and paged as one. Degrading to `undefined` routes the same input to the
 * 400 below.
 *
 * The non-object check closes the same class by the other door: `null`, `5` and
 * `"role"` are all VALID JSON, so they survive the parse and then throw a
 * `TypeError` at the destructure below — reaching the identical 500 without ever
 * touching the `.catch`.
 */
const parseRoleUpdateRequest = async (
  c: Context
): Promise<{ role: string; targetUserId: string } | Response> => {
  const parsed: unknown = await c.req.json().catch(() => undefined)
  if (parsed === null || typeof parsed !== 'object') {
    return c.json(
      { success: false, message: 'Could not parse request body', code: 'BAD_REQUEST' },
      400
    )
  }
  const { role } = parsed as { role?: string }
  if (typeof role !== 'string' || !role) {
    return validationError(c, [{ field: 'role', message: 'role field is required' }])
  }

  const targetUserId = c.req.param('id')
  if (!targetUserId) {
    return validationError(c, [{ field: 'id', message: 'User ID is required' }])
  }

  return { role, targetUserId }
}

/** The status and message of a Better Auth refusal, when `error` is one. */
const betterAuthRefusal = (
  error: unknown
): { readonly status: number; readonly message: string } | undefined => {
  const refusal = error as
    | { readonly statusCode?: unknown; readonly body?: { readonly message?: unknown } }
    | null
    | undefined
  if (typeof refusal?.statusCode !== 'number') return undefined
  const message = typeof refusal.body?.message === 'string' ? refusal.body.message : ''
  return { status: refusal.statusCode, message }
}

/**
 * Hand the role write to set-role, and answer in this route's envelope.
 *
 * The route is an alias of `POST /api/auth/admin/set-role`: the write goes
 * through Better Auth's `setRole` with the caller's own headers, so every
 * set-role rule applies here by construction rather than by a second copy — the
 * role vocabulary (400), the last-admin rail before and after the write (409),
 * the unknown account (404), and the audit entry of a change that stood.
 * set-role's refusals are mapped onto this route's envelope: a 400 names the
 * `role` field, a 409 carries the rail's wording, and a 404 — or a 401/403 that
 * cannot occur for a caller admitted above — answers as a missing resource.
 *
 * Nothing about any session is read or written: roles are read from the
 * account on every request, so the change reaches the edited user on their
 * next request without anyone being signed in, out, or switched.
 */
const applyRoleUpdate = async (
  c: Context,
  auth: BetterAuthAPI,
  targetUserId: string,
  role: string
): Promise<Response> => {
  const failure = await auth.api
    .setRole({ headers: c.req.raw.headers, body: { userId: targetUserId, role } })
    .then(
      () => undefined,
      (error: unknown) => error ?? new Error('set-role rejected without a reason')
    )
  if (failure === undefined) {
    return c.json({ success: true, message: 'User role updated successfully' }, 200)
  }
  const refusal = betterAuthRefusal(failure)
  if (refusal === undefined || refusal.status >= 500) {
    logError('[auth] the user update route could not hand the role write to set-role', failure)
    return c.json(
      { success: false, message: 'Failed to update user role', code: 'INTERNAL_ERROR' },
      500
    )
  }
  if (refusal.status === 400) {
    return validationError(c, [{ field: 'role', message: refusal.message }])
  }
  if (refusal.status === 409) return conflict(c, refusal.message)
  return notFound(c)
}

/**
 * PATCH /api/auth/admin/users/:id
 *
 * Change a user's role (admin-only).
 *
 * Writes the new role and returns `200 { success: true }`. The response sets
 * NO cookie: the change applies on the edited user's next request (roles are
 * read per request), no one is signed out, and the calling admin stays signed
 * in as themselves. An earlier version set the TARGET user's session token as
 * the admin's session cookie, which silently turned the admin's browser into
 * the edited user on a loopback bind.
 *
 * Security Controls:
 * - Requires the caller to hold the app's unrestricted role, as set-role does
 * - Returns 401 if caller is unauthenticated
 * - Returns 404 if caller is not admin (S1 anti-enumeration)
 * - Returns 400 if the role names anything the app cannot assign
 * - Returns 409 if the write would remove the last admin
 * - Returns 404 if the id matches no account; nothing is written or recorded
 */
const createAdminUserUpdateHandler =
  (app: AdminRoleResolvable, authInstance?: unknown) => async (c: Context) => {
    try {
      const auth = resolveAuthInstance(authInstance)
      if (!auth) {
        return c.json(
          { success: false, message: 'Auth instance not configured', code: 'SERVICE_UNAVAILABLE' },
          500
        )
      }

      const authorizationFailure = await authorizeAdminCaller(auth, c, app)
      if (authorizationFailure) {
        return authorizationFailure
      }

      const request = await parseRoleUpdateRequest(c)
      if (request instanceof Response) {
        return request
      }

      return await applyRoleUpdate(c, auth, request.targetUserId, request.role)
    } catch {
      return c.json(
        { success: false, message: 'Failed to update user role', code: 'INTERNAL_ERROR' },
        500
      )
    }
  }

/**
 * Chain auth routes to Hono app
 *
 * @param app - Hono app instance
 * @param authInstance - Better Auth instance for session operations
 * @returns Hono app with auth routes
 */
export const chainAuthRoutes = (
  hono: Hono,
  app: AdminRoleResolvable,
  authInstance?: unknown
): Hono => {
  hono.post('/api/auth/session/refresh', createSessionRefreshHandler(authInstance))

  hono.patch('/api/auth/admin/users/:id', createAdminUserUpdateHandler(app, authInstance))

  return hono
}
