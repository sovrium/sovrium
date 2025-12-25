/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line boundaries/element-types -- Middleware needs to access infrastructure types for session extraction
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { Context, Next } from 'hono'

/**
 * Hono context with session attached
 *
 * Used by auth middleware to store extracted session for route handlers
 */
export type ContextWithSession = Context & {
  readonly var: {
    readonly session?: Session
  }
}

/**
 * Auth middleware for Hono routes
 *
 * Extracts Better Auth session from request and attaches to context.
 * Routes can access session via `c.var.session`.
 *
 * **Session Extraction Strategy**:
 * 1. Check for Authorization header (Bearer token)
 * 2. Query Better Auth session table to validate token
 * 3. Attach session to context if valid
 * 4. Continue to route handler (session may be undefined for public routes)
 *
 * **Usage**:
 * ```typescript
 * app.use('/api/tables/*', authMiddleware(auth))
 * app.get('/api/tables/:id', async (c) => {
 *   const session = c.var.session
 *   if (!session) return c.json({ error: 'Unauthorized' }, 401)
 *   // Use session for database queries
 * })
 * ```
 *
 * @param auth - Better Auth instance with api.getSession method
 * @returns Hono middleware function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Better Auth instance type varies by configuration, using any avoids complex type assertions
export function authMiddleware(auth: any) {
  return async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header('authorization')

      // For Bearer tokens (API keys), Better Auth API key plugin expects the raw key
      // in the 'authorization' header (lowercase), not the full "Bearer {key}" string
      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        const apiKey = authHeader.slice(7) // Remove "Bearer " prefix

        // Call getSession with just the API key
        const result = await auth.api.getSession({
          headers: new Headers({
            authorization: apiKey, // Pass raw API key
          }),
        })

        // getSession returns null when no valid session exists
        if (result?.session) {
          c.set('session', result.session as Session)
        }
      } else {
        // For cookie-based sessions, use original headers
        const result = await auth.api.getSession({
          headers: c.req.raw.headers,
        })

        // getSession returns null when no valid session exists
        if (result?.session) {
          c.set('session', result.session as Session)
        }
      }
    } catch (error) {
      // Session extraction failed - log error for debugging but continue without session
      // Routes will handle unauthorized access appropriately
      console.error('[AUTH] Session extraction failed:', error)
    }

    // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue to next handler
    await next()
  }
}

/**
 * Middleware handler for requiring authentication
 */
async function requireAuthHandler(c: ContextWithSession, next: Next) {
  const { session } = c.var

  if (!session) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    )
  }

  // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue to next handler
  await next()
}

/**
 * Require authentication middleware
 *
 * Returns 401 if session is not present.
 * Use this for protected routes that require authentication.
 *
 * **Usage**:
 * ```typescript
 * app.use('/api/tables/*', authMiddleware(auth))
 * app.use('/api/tables/*', requireAuth())
 * app.get('/api/tables/:id', async (c) => {
 *   const session = c.var.session! // Safe to use non-null assertion
 *   // Session is guaranteed to exist
 * })
 * ```
 *
 * @returns Hono middleware function
 */
export function requireAuth() {
  return requireAuthHandler
}
