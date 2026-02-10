/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { logError, logWarning } from '@/infrastructure/logging/logger'
// eslint-disable-next-line boundaries/element-types -- Type-only imports don't create runtime dependencies (architectural exception)
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
 * Extract client IP address from request headers
 *
 * Checks common proxy headers in priority order:
 * 1. X-Forwarded-For (most common)
 * 2. X-Real-IP (nginx)
 * 3. CF-Connecting-IP (Cloudflare)
 * 4. Falls back to direct connection IP
 */
function getClientIP(c: Context): string | undefined {
  const xForwardedFor = c.req.header('x-forwarded-for')
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one (client)
    return xForwardedFor.split(',')[0]?.trim()
  }

  const xRealIp = c.req.header('x-real-ip')
  if (xRealIp) {
    return xRealIp
  }

  const cfConnectingIp = c.req.header('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Fallback to undefined if no IP headers found
  return undefined
}

/**
 * Validate session binding to original IP and User-Agent
 *
 * When strict mode is enabled, sessions are bound to the IP address and
 * User-Agent that created them. This prevents session hijacking attacks.
 *
 * @param session - Session object from database
 * @param currentIP - Current request IP address
 * @param currentUserAgent - Current request User-Agent
 * @returns true if session is valid, false if binding validation fails
 */
function validateSessionBinding(
  session: Session,
  currentIP: string | undefined,
  currentUserAgent: string | undefined
): boolean {
  // For now, allow sessions without binding metadata (backward compatibility)
  // This will be tightened when strict mode is explicitly enabled
  if (!session.ipAddress && !session.userAgent) {
    return true
  }

  // If session has IP binding, validate it matches
  if (session.ipAddress && currentIP && session.ipAddress !== currentIP) {
    return false
  }

  // If session has User-Agent binding, validate it matches
  if (session.userAgent && currentUserAgent && session.userAgent !== currentUserAgent) {
    return false
  }

  return true
}

/**
 * Process session result and attach to context if valid
 *
 * Validates session binding and logs security warnings for failed validations.
 */
function processSessionResult(
  c: Context,
  sessionResult: { readonly session?: Session } | null
): void {
  if (!sessionResult?.session) {
    return
  }

  const currentIP = getClientIP(c)
  const currentUserAgent = c.req.header('user-agent')

  if (validateSessionBinding(sessionResult.session as Session, currentIP, currentUserAgent)) {
    c.set('session', sessionResult.session as Session)
  } else {
    // Session binding validation failed - log for security monitoring
    logWarning(
      `[AUTH] Session binding validation failed: ${JSON.stringify({
        sessionId: sessionResult.session.id,
        expectedIP: sessionResult.session.ipAddress,
        currentIP,
        expectedUserAgent: sessionResult.session.userAgent,
        currentUserAgent,
      })}`
    )
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
 * 3. Validate session binding (IP/User-Agent) if strict mode enabled
 * 4. Attach session to context if valid
 * 5. Continue to route handler (session may be undefined for public routes)
 *
 * **Session Binding (Strict Mode)**:
 * When enabled, sessions are bound to the IP address and User-Agent that
 * created them. Requests from different IP/User-Agent will be rejected.
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

      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        const apiKey = authHeader.slice(7)
        const result = await auth.api.getSession({
          headers: new Headers({ authorization: apiKey }),
        })
        processSessionResult(c, result)
      } else {
        const result = await auth.api.getSession({
          headers: c.req.raw.headers,
        })
        processSessionResult(c, result)
      }
    } catch (error) {
      logError('[AUTH] Session extraction failed', error)
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
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
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
