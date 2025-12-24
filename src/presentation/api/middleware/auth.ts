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
export function authMiddleware(auth: {
  api: { getSession: (options: { headers: Headers }) => Promise<{ session: Session | null }> }
  handler: (request: Request) => Promise<Response>
}) {
  return async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header('Authorization')

      // For Bearer tokens (API keys), extract the key and pass it as the authorization header
      // Better Auth's API key plugin expects the raw API key, not "Bearer {key}"
      if (authHeader?.startsWith('Bearer ')) {
        const apiKey = authHeader.slice(7) // Remove "Bearer " prefix

        // Call getSession with the API key in the authorization header
        const result = await auth.api.getSession({
          headers: new Headers({
            authorization: apiKey, // Pass raw API key
          }),
        })

        const { session } = result
        if (session) {
          c.set('session', session)
        }
      } else {
        // For cookie-based sessions, use original headers
        const result = await auth.api.getSession({
          headers: c.req.raw.headers,
        })

        const { session } = result
        if (session) {
          c.set('session', session)
        }
      }
    } catch {
      // Session extraction failed - continue without session
      // Routes will handle unauthorized access appropriately
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

/**
 * Middleware handler for API key user isolation on delete endpoint
 *
 * Validates that the user making the request owns the API key they're trying to delete.
 * Returns 404 instead of 403 to prevent user enumeration.
 */
async function apiKeyOwnershipCheckHandler(c: ContextWithSession, next: Next) {
  const { session } = c.var

  // Auth middleware should have already validated session, but check again
  if (!session) {
    return c.json({ message: 'Unauthorized' }, 401)
  }

  // Get keyId from request body
  const body = await c.req.json().catch(() => ({}))
  const { keyId } = body

  if (!keyId) {
    return c.json({ message: 'Missing keyId' }, 400)
  }

  // Check if API key belongs to the user
  const { db } = await import('@/infrastructure/database')
  const { apiKeys } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq, and } = await import('drizzle-orm')

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, session.userId)))
    .limit(1)

  if (!apiKey) {
    // Return 404 instead of 403 to prevent user enumeration
    // (don't reveal if key exists for another user)
    return c.json({ message: 'API key not found' }, 404)
  }

  // User owns the key, continue to Better Auth's delete handler
  // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue to next handler
  await next()
}

/**
 * Middleware for API key user isolation on delete endpoint
 *
 * Validates that the user making the request owns the API key they're trying to delete.
 * Returns 404 instead of 403 to prevent user enumeration.
 *
 * **Usage**:
 * ```typescript
 * app.use('/api/auth/api-key/delete', authMiddleware(auth))
 * app.use('/api/auth/api-key/delete', apiKeyOwnershipCheck())
 * ```
 *
 * @returns Hono middleware function
 */
export function apiKeyOwnershipCheck() {
  return apiKeyOwnershipCheckHandler
}
