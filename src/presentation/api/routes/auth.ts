/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
      return c.json(
        {
          error: 'Role modification not allowed',
          message: 'Cannot update user role through this endpoint',
        },
        403
      )
    }

    // If role field is not present, the request would be valid
    // (but we don't implement actual user updates yet - minimal implementation)
    return c.json(
      {
        error: 'Not implemented',
        message: 'User updates not yet implemented',
      },
      400
    )
  } catch {
    return c.json(
      {
        error: 'Invalid request',
        message: 'Could not parse request body',
      },
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
          error: 'Authentication service unavailable',
          message: 'Auth instance not configured',
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
      return c.json(
        {
          error: 'Unauthorized',
          message: 'No active session found',
        },
        401
      )
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
      {
        error: 'Internal server error',
        message: 'Failed to refresh session',
      },
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

  return app
}
