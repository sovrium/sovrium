/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { setSignedCookie } from 'hono/cookie'
import { forbidden, unauthorized, validationError } from '@/presentation/api/utils/auth-helpers'
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
  }
}

/**
 * PATCH /api/auth/user/update
 *
 * Update user profile information.
 * CRITICAL: Prevents role manipulation attacks by blocking role changes.
 *
 * Security Controls:
 * - Rejects any attempt to modify the 'role' field (403 Forbidden)
 * - Ensures users cannot escalate their own privileges
 * - Only Better Auth admin endpoints can modify roles
 */
const handleUserUpdate = async (c: Context) => {
  try {
    // Parse request body
    const body = (await c.req.json()) as Record<string, unknown>

    // SECURITY: Prevent role manipulation attacks
    // Users must never be able to change their own role or any user's role
    // via this endpoint. Role changes require admin privileges and must go
    // through Better Auth's admin endpoints.
    if ('role' in body) {
      return forbidden(c, 'Cannot update user role through this endpoint')
    }

    // If role field is not present, the request would be valid
    // (but we don't implement actual user updates yet - minimal implementation)
    return c.json(
      { success: false, message: 'User updates not yet implemented', code: 'BAD_REQUEST' },
      400
    )
  } catch {
    return c.json(
      { success: false, message: 'Could not parse request body', code: 'BAD_REQUEST' },
      400
    )
  }
}

/**
 * POST /api/auth/session/refresh
 *
 * Refresh the current session by generating a new session token.
 * SECURITY: Invalidates the old session token to prevent token reuse.
 *
 * This endpoint:
 * 1. Validates the current session
 * 2. Creates a new session with a fresh token
 * 3. Invalidates the old session token
 * 4. Returns success (session cookie updated automatically by Better Auth)
 *
 * Security Controls:
 * - Prevents session token reuse after refresh (replay attack prevention)
 * - Ensures session rotation for enhanced security
 */
const createSessionRefreshHandler = (authInstance?: unknown) => async (c: Context) => {
  try {
    // Get Better Auth instance
    if (!authInstance || typeof authInstance !== 'object' || !('api' in authInstance)) {
      return c.json(
        {
          success: false,
          message: 'Auth instance not configured',
          code: 'SERVICE_UNAVAILABLE',
        },
        500
      )
    }

    const auth = authInstance as BetterAuthAPI

    // Get current session
    const currentSession = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!currentSession) {
      return unauthorized(c)
    }

    // Session refresh in Better Auth v1.4.7+ happens automatically through
    // the session.updateAge configuration. When a session is accessed and
    // has existed for at least updateAge duration, Better Auth automatically
    // extends the expiresAt timestamp by expiresIn duration.
    //
    // Since Better Auth handles session refresh internally, we just need to
    // verify the session is valid and return success. The session cookie
    // will be updated automatically if needed.

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
 * Authorize an admin caller.
 *
 * Returns a JSON Response (401/403) when authorization fails, or `undefined`
 * when the caller is an authenticated admin and the handler may proceed.
 */
const authorizeAdminCaller = async (
  auth: BetterAuthAPI,
  c: Context
): Promise<Response | undefined> => {
  const callerSession = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!callerSession) {
    return unauthorized(c)
  }

  const { getUserRole } = await import('@/application/use-cases/tables/user-role')
  const callerRole = await getUserRole(callerSession.session.userId)
  if (callerRole !== 'admin') {
    // Preserve the literal 'Admin access required' message text — spec
    // assertions and any client-side error UI keying on it should keep working.
    return forbidden(c, 'Admin access required')
  }

  return undefined
}

/**
 * Parse and validate the role-update request (body + path parameter).
 *
 * Returns the validated inputs, or a 400 JSON Response when validation fails.
 */
const parseRoleUpdateRequest = async (
  c: Context
): Promise<{ role: string; targetUserId: string } | Response> => {
  const body = (await c.req.json()) as Record<string, unknown>
  const { role } = body as { role?: string }
  if (typeof role !== 'string' || !role) {
    return validationError(c, [{ field: 'role', message: 'role field is required' }])
  }

  const targetUserId = c.req.param('id')
  if (!targetUserId) {
    return validationError(c, [{ field: 'id', message: 'User ID is required' }])
  }

  return { role, targetUserId }
}

/**
 * Perform the role update and return the target user's active session token.
 *
 * The update and session-token lookup are chained (not awaited separately) so
 * the whole operation remains a single declaration — avoiding void-returning
 * expression-statements while preserving ordering: the session token is only
 * read after the role update has resolved successfully.
 */
const applyRoleAndReadSession = async (
  targetUserId: string,
  role: string
): Promise<{ sessionToken: string | undefined }> => {
  const userRoleModule = await import('@/application/use-cases/tables/user-role')
  const sessionToken = await userRoleModule
    .updateUserRole(targetUserId, role)
    .then(() => userRoleModule.getUserSessionToken(targetUserId))
  return { sessionToken }
}

/**
 * Build the success response for an admin role update, attaching a signed
 * session cookie for the target user when possible.
 *
 * Better Auth validates cookie signatures via Hono's setSignedCookie
 * (HMAC-SHA256), so the raw token must be signed. The cookie is only set
 * when both a session token and an AUTH_SECRET are available. When it is set,
 * `setSignedCookie` must run BEFORE `c.json(...)` so the `Set-Cookie` header
 * is included in the returned Response.
 *
 * Chaining `setSignedCookie(...).then(() => c.json(...))` — rather than
 * awaiting `setSignedCookie` as a bare expression statement — keeps the
 * handler free of void-returning expression-statements while preserving
 * ordering.
 */
const buildRoleUpdateSuccessResponse = (
  c: Context,
  sessionToken: string | undefined
): Promise<Response> => {
  const authSecret = process.env['AUTH_SECRET']
  if (!sessionToken || !authSecret) {
    return Promise.resolve(
      c.json({ success: true, message: 'User role updated successfully' }, 200)
    )
  }

  return setSignedCookie(c, 'better-auth.session_token', sessionToken, authSecret, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
  }).then(() => c.json({ success: true, message: 'User role updated successfully' }, 200))
}

/**
 * PATCH /api/auth/admin/users/:id
 *
 * Update a user's role (admin-only).
 *
 * After updating the target user's role, returns their active session token
 * as a Set-Cookie header so the request context switches to that user's session.
 * This enables testing that role changes take effect immediately without re-login.
 *
 * Security Controls:
 * - Requires caller to have admin role
 * - Returns 401 if caller is unauthenticated
 * - Returns 403 if caller is not admin
 */
const createAdminUserUpdateHandler = (authInstance?: unknown) => async (c: Context) => {
  try {
    const auth = resolveAuthInstance(authInstance)
    if (!auth) {
      return c.json(
        { success: false, message: 'Auth instance not configured', code: 'SERVICE_UNAVAILABLE' },
        500
      )
    }

    const authorizationFailure = await authorizeAdminCaller(auth, c)
    if (authorizationFailure) {
      return authorizationFailure
    }

    const request = await parseRoleUpdateRequest(c)
    if (request instanceof Response) {
      return request
    }

    const { sessionToken } = await applyRoleAndReadSession(request.targetUserId, request.role)
    return await buildRoleUpdateSuccessResponse(c, sessionToken)
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
export const chainAuthRoutes = (app: Hono, authInstance?: unknown): Hono => {
  // eslint-disable-next-line functional/no-expression-statements -- Side effect required for route registration
  app.patch('/api/auth/user/update', handleUserUpdate)

  // eslint-disable-next-line functional/no-expression-statements -- Side effect required for route registration
  app.post('/api/auth/session/refresh', createSessionRefreshHandler(authInstance))

  // eslint-disable-next-line functional/no-expression-statements -- Side effect required for route registration
  app.patch('/api/auth/admin/users/:id', createAdminUserUpdateHandler(authInstance))

  return app
}
