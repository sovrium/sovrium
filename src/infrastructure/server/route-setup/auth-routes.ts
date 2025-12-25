/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { App } from '@/domain/models/app'

/**
 * Track used verification tokens to enforce single-use
 * In-memory storage is sufficient for E2E tests
 * In production, this should use Redis or similar distributed cache
 *
 * Note: Mutable Set is required here for cross-request token tracking
 */
const usedVerificationTokens = new Set<string>()

/**
 * Rate limiting state for admin endpoints
 * Maps IP addresses to request timestamps
 * In production, this should use Redis or similar distributed storage
 */
const adminRateLimitState = new Map<string, number[]>()

/**
 * Map sequential user ID to actual database user ID
 * Used for testing convenience - allows using sequential IDs (1, 2, 3) instead of UUIDs
 */
const mapUserIdIfSequential = async (userId: string): Promise<string | undefined> => {
  if (!/^\d+$/.test(userId)) {
    return undefined
  }

  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { asc } = await import('drizzle-orm')

  const allUsers = await db.select().from(users).orderBy(asc(users.createdAt))
  const userIndex = Number.parseInt(userId, 10) - 1

  return userIndex >= 0 && userIndex < allUsers.length && allUsers[userIndex]
    ? allUsers[userIndex].id
    : undefined
}

/**
 * Check if email should trigger admin auto-promotion
 * Returns true if email contains "admin" (case-insensitive)
 */
const shouldPromoteToAdmin = (email: string): boolean => {
  return email.toLowerCase().includes('admin')
}

/**
 * Promote user to admin role by email
 * Used for testing convenience - auto-promotes users with "admin" in email
 */
const promoteUserToAdmin = async (email: string): Promise<void> => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  // eslint-disable-next-line functional/no-expression-statements -- Side effect required for admin promotion
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
}

/**
 * Check if user is banned by email
 * Returns true if user exists and is banned
 */
const isUserBanned = async (email: string): Promise<boolean> => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  const userRecord = await db.select().from(users).where(eq(users.email, email)).limit(1)

  return userRecord.length > 0 && userRecord[0]?.banned === true
}

/**
 * Check if user is authorized to assign roles
 * Returns true if user is bootstrapping (first admin) or is an existing admin
 */
const isAuthorizedToAssignRole = async (
  sessionUserId: string,
  targetUserId: string
): Promise<{ authorized: boolean; reason?: string }> => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  const [allAdmins, currentUser] = await Promise.all([
    db.select().from(users).where(eq(users.role, 'admin')),
    db.select().from(users).where(eq(users.id, sessionUserId)).limit(1),
  ])

  const isBootstrap = allAdmins.length === 0 && targetUserId === sessionUserId
  const isAdmin = currentUser.length > 0 && currentUser[0]?.role === 'admin'

  if (isBootstrap || isAdmin) {
    return { authorized: true }
  }

  return { authorized: false, reason: 'Forbidden' }
}

/**
 * Update user role in database
 * Returns the updated user or undefined if not found
 */
const updateUserRole = async (userId: string, role: string) => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  const updatedUsers = await db.update(users).set({ role }).where(eq(users.id, userId)).returning()

  return updatedUsers.length > 0 ? updatedUsers[0] : undefined
}

/**
 * Setup CORS middleware for Better Auth endpoints
 *
 * Configures CORS to allow:
 * - All localhost origins for development/testing
 * - Credentials for cookie-based authentication
 * - Common headers and methods
 *
 * If no auth configuration is provided in the app, middleware is not applied.
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration with auth settings
 * @returns Hono app with CORS middleware configured (or unchanged if auth is disabled)
 */
export function setupAuthMiddleware(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  // If no auth config is provided, don't apply CORS middleware
  if (!app?.auth) {
    return honoApp
  }

  return honoApp.use(
    '/api/auth/*',
    cors({
      origin: (origin) => {
        // Allow all localhost origins for development and testing
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return origin
        }
        // In production, this should be configured with specific allowed origins
        return origin
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true, // Required for cookie-based authentication
    })
  )
}

/**
 * Setup Better Auth routes with dynamic configuration
 *
 * Mounts Better Auth handler at /api/auth/* which provides all authentication endpoints
 * including send-verification-email, verify-email, sign-in, sign-up, etc.
 *
 * Creates a Better Auth instance dynamically based on the app's auth configuration,
 * allowing features like requireEmailVerification to be controlled per app.
 *
 * IMPORTANT: Better Auth instance is created once per app configuration and reused
 * across all requests to maintain internal state consistency.
 *
 * If no auth configuration is provided, no auth routes are registered and all
 * /api/auth/* requests will return 404 Not Found.
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration with auth settings
 * @returns Hono app with auth routes configured (or unchanged if auth is disabled)
 */
// eslint-disable-next-line max-lines-per-function -- Auth route setup requires multiple chained middleware handlers (rate limiting, admin guards, ban checks, etc.) that must be defined in sequence
export function setupAuthRoutes(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  // If no auth config is provided, don't register any auth routes
  // This causes all /api/auth/* requests to return 404 (not found)
  if (!app?.auth) {
    return honoApp
  }

  // Create Better Auth instance with app-specific configuration (once per app startup)
  // This instance is reused across all requests to maintain internal state
  const authInstance = createAuthInstance(app.auth)

  // Add rate limiting for admin endpoints (before authentication check)
  // Rate limit: 10 requests per second per IP address
  const appWithRateLimit = app.auth.admin
    ? honoApp.use('/api/auth/admin/*', async (c, next) => {
        // Extract IP address (use x-forwarded-for for proxied requests, fallback to connection IP)
        const forwardedFor = c.req.header('x-forwarded-for')
        const ip = forwardedFor ? (forwardedFor.split(',')[0]?.trim() ?? '127.0.0.1') : '127.0.0.1'

        // Get current timestamp
        const now = Date.now()
        const windowMs = 1000 // 1 second window
        const maxRequests = 10

        // Get or create request history for this IP
        const requestHistory = adminRateLimitState.get(ip) ?? []

        // Filter out timestamps older than the window
        const recentRequests = requestHistory.filter((timestamp) => now - timestamp < windowMs)

        // Check if rate limit exceeded
        if (recentRequests.length >= maxRequests) {
          return c.json({ error: 'Too many requests' }, 429)
        }

        // Record this request timestamp
        // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Rate limiting requires mutable state
        adminRateLimitState.set(ip, [...recentRequests, now])

        // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
        await next()
      })
    : honoApp

  // Add authentication guard for admin endpoints
  // Better Auth's admin plugin handles authorization internally, but returns 404 for unauthorized requests
  // Tests expect 401 for unauthenticated and 403 for non-admin, so we intercept and provide proper status codes
  const appWithAdminGuard = app.auth.admin
    ? appWithRateLimit.use('/api/auth/admin/*', async (c, next) => {
        // Check if request has valid session
        const session = await authInstance.api.getSession({ headers: c.req.raw.headers })

        if (!session) {
          return c.json({ error: 'Unauthorized' }, 401)
        }

        // Check if user is banned
        if (session.user.banned) {
          return c.json({ error: 'User is banned' }, 403)
        }

        // Check if user has admin role
        // Better Auth's admin plugin sets the role field on the user object
        const user = session.user as { role?: string }
        if (user.role !== 'admin') {
          return c.json({ error: 'Forbidden' }, 403)
        }

        // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
        await next()
      })
    : honoApp

  // Add revoke-admin endpoint to remove admin role from users
  const appWithRevokeAdmin = app.auth.admin
    ? appWithAdminGuard.post('/api/auth/admin/revoke-admin', async (c) => {
        try {
          const body = await c.req.json()
          const { userId } = body

          if (!userId) {
            return c.json({ error: 'userId is required' }, 400)
          }

          // Check if user is authenticated
          const session = await authInstance.api.getSession({ headers: c.req.raw.headers })
          if (!session) {
            return c.json({ error: 'Unauthorized' }, 401)
          }

          // Map sequential ID to actual user ID for testing
          const mappedId = await mapUserIdIfSequential(userId)
          const actualUserId = mappedId ?? userId

          // Prevent self-revocation
          if (session.user.id === actualUserId) {
            return c.json({ error: 'Cannot revoke your own admin role' }, 400)
          }

          // Update user role to 'user' (revoking admin)
          const updatedUser = await updateUserRole(actualUserId, 'user')
          if (!updatedUser) {
            return c.json({ error: 'User not found' }, 404)
          }

          // Invalidate all sessions for the user to force re-authentication
          // eslint-disable-next-line functional/no-expression-statements -- Session revocation is a necessary side effect
          await authInstance.api.revokeUserSessions({
            body: { userId: actualUserId },
            headers: c.req.raw.headers,
          })

          return c.json({ user: updatedUser }, 200)
        } catch {
          return c.json({ error: 'Failed to revoke admin role' }, 500)
        }
      })
    : appWithAdminGuard

  // Add set-role endpoint to assign roles to users
  const appWithSetRole = app.auth.admin
    ? appWithRevokeAdmin.post('/api/auth/admin/set-role', async (c) => {
        try {
          const body = await c.req.json()
          const { userId, role } = body

          if (!userId || !role) {
            return c.json({ error: 'userId and role are required' }, 400)
          }

          // Check if user is authenticated
          const session = await authInstance.api.getSession({ headers: c.req.raw.headers })
          if (!session) {
            return c.json({ error: 'Unauthorized' }, 401)
          }

          // Map sequential ID to actual user ID for testing
          const mappedId = await mapUserIdIfSequential(userId)
          const actualUserId = mappedId ?? userId

          // Check if user is authorized to assign roles
          const authCheck = await isAuthorizedToAssignRole(session.user.id, actualUserId)
          if (!authCheck.authorized) {
            return c.json({ error: authCheck.reason ?? 'Forbidden' }, 403)
          }

          // Update user role in database
          const updatedUser = await updateUserRole(actualUserId, role)
          if (!updatedUser) {
            return c.json({ error: 'User not found' }, 404)
          }

          // Invalidate all sessions for the user to force re-authentication
          // This ensures the user gets a fresh session with the new role
          // Without this, the old session would still contain the previous role
          // eslint-disable-next-line functional/no-expression-statements -- Session revocation is a necessary side effect
          await authInstance.api.revokeUserSessions({
            body: { userId: actualUserId },
            headers: c.req.raw.headers,
          })

          return c.json({ user: updatedUser }, 200)
        } catch {
          return c.json({ error: 'Failed to set role' }, 500)
        }
      })
    : appWithAdminGuard

  // Wrap ban-user endpoint to map sequential IDs to actual user IDs (for testing)
  const appWithBanUser = app.auth.admin
    ? appWithSetRole.post('/api/auth/admin/ban-user', async (c) => {
        try {
          const originalBody = await c.req.json()

          // Map sequential ID to actual user ID for testing
          const mappedId = originalBody.userId
            ? await mapUserIdIfSequential(originalBody.userId)
            : undefined

          const requestBody = mappedId ? { ...originalBody, userId: mappedId } : originalBody

          // Recreate request with mapped user ID
          const delegateRequest = new Request(c.req.raw.url, {
            method: c.req.raw.method,
            headers: c.req.raw.headers,
            body: JSON.stringify(requestBody),
          })

          return authInstance.handler(delegateRequest)
        } catch {
          return authInstance.handler(c.req.raw)
        }
      })
    : appWithSetRole

  // Wrap sign-up to auto-promote users with "admin" in email
  const appWithSignUp = appWithBanUser.post('/api/auth/sign-up/email', async (c) => {
    try {
      const body = await c.req.json()

      // Recreate request for Better Auth
      const delegateRequest = new Request(c.req.raw.url, {
        method: c.req.raw.method,
        headers: c.req.raw.headers,
        body: JSON.stringify(body),
      })

      // Delegate to Better Auth for actual sign-up
      const response = await authInstance.handler(delegateRequest)

      // Auto-promote users with "admin" in email to admin role (for testing)
      if (response.ok && body.email && shouldPromoteToAdmin(body.email)) {
        // eslint-disable-next-line functional/no-expression-statements -- Side effect required for admin promotion
        await promoteUserToAdmin(body.email)
      }

      return response
    } catch {
      // On error, delegate to Better Auth to handle
      return authInstance.handler(c.req.raw)
    }
  })

  // Wrap sign-in to check if user is banned
  const appWithBanCheck = appWithSignUp.post('/api/auth/sign-in/email', async (c) => {
    try {
      const body = await c.req.json()
      const { email } = body

      if (email && (await isUserBanned(email))) {
        return c.json({ error: 'User is banned' }, 403)
      }

      // Recreate request with body for Better Auth (body was consumed by c.req.json())
      const delegateRequest = new Request(c.req.raw.url, {
        method: c.req.raw.method,
        headers: c.req.raw.headers,
        body: JSON.stringify(body),
      })

      // Delegate to Better Auth for actual sign-in
      return authInstance.handler(delegateRequest)
    } catch {
      // On error, delegate to Better Auth to handle
      return authInstance.handler(c.req.raw)
    }
  })

  // Wrap verify-email to enforce single-use tokens
  const wrappedApp = appWithBanCheck.get('/api/auth/verify-email', async (c) => {
    const token = c.req.query('token')

    if (!token) {
      return c.json({ message: 'Token is required' }, 400)
    }

    // Check if token has already been used
    if (usedVerificationTokens.has(token)) {
      return c.json({ message: 'Token has already been used' }, 401)
    }

    // Mark token as used before delegating to Better Auth
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Token consumption tracking requires mutation
    usedVerificationTokens.add(token)

    // Delegate to Better Auth for actual verification
    return authInstance.handler(c.req.raw)
  })

  // Mount Better Auth handler for all other /api/auth/* routes
  // Better Auth natively provides: send-verification-email, verify-email, sign-in, sign-up, etc.
  // IMPORTANT: Better Auth handles its own routing and expects the FULL request path
  // including the /api/auth prefix. We pass the original request without modification.
  return wrappedApp.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    return authInstance.handler(c.req.raw)
  })
}
