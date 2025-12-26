/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Hono } from 'hono'

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
 * Chain auth routes to Hono app
 *
 * @param app - Hono app instance
 * @param _authInstance - Better Auth instance (reserved for future session validation)
 * @returns Hono app with auth routes
 */
export const chainAuthRoutes = (app: Hono, _authInstance?: unknown): Hono => {
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
  // eslint-disable-next-line functional/no-expression-statements -- Side effect required for route handler
  app.patch('/api/auth/user/update', async (c) => {
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
  })

  return app
}
