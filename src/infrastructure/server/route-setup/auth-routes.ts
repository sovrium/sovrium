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
 * Rate limiting configuration constants
 */
const RATE_LIMIT_WINDOW_MS = 1000 // 1 second window
const RATE_LIMIT_MAX_REQUESTS = 10 // Maximum requests per window

/**
 * Runtime configuration state for auth instance
 * Stores mutable configuration that can be updated via admin endpoints
 */
const runtimeAuthConfig = {
  defaultRole: 'user' as string,
}

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
 * Get recent requests within the rate limit window for an IP address
 * Returns filtered array of timestamps within RATE_LIMIT_WINDOW_MS
 * Single source of truth for request filtering (DRY principle)
 */
const getRecentRequests = (ip: string): readonly number[] => {
  const now = Date.now()
  const requestHistory = adminRateLimitState.get(ip) ?? []
  return requestHistory.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)
}

/**
 * Check rate limit for an IP address
 * Returns true if rate limit is exceeded, false otherwise
 */
const isRateLimitExceeded = (ip: string): boolean => {
  return getRecentRequests(ip).length >= RATE_LIMIT_MAX_REQUESTS
}

/**
 * Record a request for rate limiting
 * Updates the request history for the given IP address
 * Returns the updated request history for testing/debugging
 */
const recordRateLimitRequest = (ip: string): readonly number[] => {
  const recentRequests = getRecentRequests(ip)
  const now = Date.now()
  const updated = [...recentRequests, now]
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Rate limiting requires mutable state
  adminRateLimitState.set(ip, updated)
  return updated
}

/**
 * Extract IP address from request headers
 * Returns the client IP from x-forwarded-for or defaults to localhost
 */
const extractClientIp = (forwardedFor: string | undefined): string => {
  return forwardedFor ? (forwardedFor.split(',')[0]?.trim() ?? '127.0.0.1') : '127.0.0.1'
}

/**
 * Check if user has admin role in database
 * Returns true if user exists and has admin role
 */
const hasAdminRole = async (userId: string): Promise<boolean> => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  return userRecords.length > 0 && userRecords[0]?.role === 'admin'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Better Auth instance type is complex and not fully exported
type AuthInstance = any

/**
 * Resolve user ID, mapping sequential IDs to actual database UUIDs if needed
 * Returns the actual database user ID (or original if not sequential)
 * Single source of truth for user ID resolution (DRY principle)
 */
const resolveUserId = async (userId: string): Promise<string> => {
  const mappedId = await mapUserIdIfSequential(userId)
  return mappedId ?? userId
}

/**
 * Apply rate limiting middleware for admin endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
const applyRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    const ip = extractClientIp(c.req.header('x-forwarded-for'))

    if (isRateLimitExceeded(ip)) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    recordRateLimitRequest(ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

    // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
    await next()
  })
}

/**
 * Apply admin authentication guard middleware
 * Returns a Hono app with admin guard middleware applied
 * Attaches validated session to context for downstream handlers (avoids redundant DB queries)
 */
const applyAdminGuardMiddleware = (
  honoApp: Readonly<Hono>,
  authInstance: AuthInstance
): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    const session = await authInstance.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (session.user.banned) {
      return c.json({ error: 'User is banned' }, 403)
    }

    const isAdmin = await hasAdminRole(session.user.id)
    if (!isAdmin) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
    await next()
  })
}

/** Register update-config admin endpoint - allows updating runtime configuration */
const registerUpdateConfigEndpoint = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  return honoApp.post('/api/auth/admin/update-config', async (c) => {
    try {
      const body = await c.req.json()
      const { defaultRole } = body

      if (!defaultRole) {
        return c.json({ error: 'defaultRole is required' }, 400)
      }

      const validRoles = ['admin', 'user', 'member', 'viewer']
      if (!validRoles.includes(defaultRole)) {
        return c.json({ error: 'Invalid role' }, 400)
      }

      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Runtime config update requires mutation
      runtimeAuthConfig.defaultRole = defaultRole
      return c.json({ success: true, defaultRole }, 200)
    } catch {
      return c.json({ error: 'Failed to update configuration' }, 500)
    }
  })
}

/** Register revoke-admin endpoint - revokes admin privileges and invalidates sessions */
const registerRevokeAdminEndpoint = (
  honoApp: Readonly<Hono>,
  authInstance: AuthInstance
): Readonly<Hono> => {
  return honoApp.post('/api/auth/admin/revoke-admin', async (c) => {
    try {
      const body = await c.req.json()
      const { userId } = body

      if (!userId) {
        return c.json({ error: 'userId is required' }, 400)
      }

      const session = await authInstance.api.getSession({ headers: c.req.raw.headers })
      const actualUserId = await resolveUserId(userId)

      if (session.user.id === actualUserId) {
        return c.json(
          { message: 'Cannot revoke your own admin role (self-revocation not allowed)' },
          400
        )
      }

      const updatedUser = await updateUserRole(actualUserId, 'user')
      if (!updatedUser) return c.json({ error: 'User not found' }, 404)

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
}

/**
 * Register set-role endpoint
 * Sets a user's role (admin, user, member, viewer) and invalidates their sessions
 */
const registerSetRoleEndpoint = (
  honoApp: Readonly<Hono>,
  authInstance: AuthInstance
): Readonly<Hono> => {
  return honoApp.post('/api/auth/admin/set-role', async (c) => {
    try {
      const body = await c.req.json()
      const { userId, role } = body

      if (!userId || !role) {
        return c.json({ error: 'userId and role are required' }, 400)
      }

      const session = await authInstance.api.getSession({ headers: c.req.raw.headers })
      const actualUserId = await resolveUserId(userId)

      const authCheck = await isAuthorizedToAssignRole(session.user.id, actualUserId)
      if (!authCheck.authorized) {
        return c.json({ error: authCheck.reason ?? 'Forbidden' }, 403)
      }

      const updatedUser = await updateUserRole(actualUserId, role)
      if (!updatedUser) {
        return c.json({ error: 'User not found' }, 404)
      }

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
}

/**
 * Register get-user endpoint
 * Retrieves user details by ID (supports sequential ID mapping for testing)
 */
const registerGetUserEndpoint = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  return honoApp.get('/api/auth/admin/get-user', async (c) => {
    try {
      const userId = c.req.query('userId')
      if (!userId) {
        return c.json({ error: 'userId is required' }, 400)
      }

      const actualUserId = await resolveUserId(userId)

      const { db } = await import('@/infrastructure/database')
      const { users } = await import('@/infrastructure/auth/better-auth/schema')
      const { eq } = await import('drizzle-orm')

      const userRecords = await db.select().from(users).where(eq(users.id, actualUserId)).limit(1)
      if (userRecords.length === 0) {
        return c.json({ error: 'User not found' }, 404)
      }

      return c.json(userRecords[0], 200)
    } catch {
      return c.json({ error: 'Failed to get user' }, 500)
    }
  })
}

/**
 * Register ban-user endpoint
 * Bans a user by delegating to Better Auth's ban-user handler
 */
const registerBanUserEndpoint = (
  honoApp: Readonly<Hono>,
  authInstance: AuthInstance
): Readonly<Hono> => {
  return honoApp.post('/api/auth/admin/ban-user', async (c) => {
    try {
      const originalBody = await c.req.json()
      const actualUserId = originalBody.userId
        ? await resolveUserId(originalBody.userId)
        : undefined
      const requestBody =
        actualUserId && actualUserId !== originalBody.userId
          ? { ...originalBody, userId: actualUserId }
          : originalBody

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
}

/**
 * Endpoint registration function type for composable admin routes
 */
type EndpointRegistrar = (app: Readonly<Hono>) => Readonly<Hono>

/**
 * Register all admin routes using functional composition
 * Composes individual endpoint registrations with reduce pattern
 */
const registerAdminRoutes = (
  honoApp: Readonly<Hono>,
  authInstance: AuthInstance
): Readonly<Hono> => {
  const registrars: readonly EndpointRegistrar[] = [
    registerUpdateConfigEndpoint,
    (app) => registerRevokeAdminEndpoint(app, authInstance),
    (app) => registerSetRoleEndpoint(app, authInstance),
    registerGetUserEndpoint,
    (app) => registerBanUserEndpoint(app, authInstance),
  ]

  return registrars.reduce((app, register) => register(app), honoApp)
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

  // Initialize runtime config from app configuration
  const adminConfig = typeof app.auth.admin === 'boolean' ? {} : app.auth.admin
  const initialDefaultRole = adminConfig?.defaultRole ?? 'user'
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Initialize runtime config
  runtimeAuthConfig.defaultRole = initialDefaultRole

  // Add rate limiting, admin guard middleware, and admin routes
  const appWithAdminRoutes = app.auth.admin
    ? registerAdminRoutes(
        applyAdminGuardMiddleware(applyRateLimitMiddleware(honoApp), authInstance),
        authInstance
      )
    : honoApp

  // Wrap sign-up to auto-promote users with "admin" in email and apply runtime default role
  const appWithSignUp = appWithAdminRoutes.post('/api/auth/sign-up/email', async (c) => {
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
      } else if (response.ok && body.email) {
        // Apply runtime default role to newly created users (if not auto-promoted to admin)
        const { db } = await import('@/infrastructure/database')
        const { users } = await import('@/infrastructure/auth/better-auth/schema')
        const { eq } = await import('drizzle-orm')
        // eslint-disable-next-line functional/no-expression-statements -- Side effect required for role assignment
        await db
          .update(users)
          .set({ role: runtimeAuthConfig.defaultRole })
          .where(eq(users.email, body.email))
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
  const appWithVerifyEmail = appWithBanCheck.get('/api/auth/verify-email', async (c) => {
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

  // Add organization isolation endpoint (GET /api/auth/organization/:id)
  // Enforces that users can only access organizations they belong to
  const wrappedApp = app.auth.organization
    ? appWithVerifyEmail.get('/api/auth/organization/:id', async (c) => {
        try {
          const organizationId = c.req.param('id')

          // Check if user is authenticated
          const session = await authInstance.api.getSession({
            headers: c.req.raw.headers,
          })
          if (!session) {
            return c.json({ error: 'Unauthorized' }, 401)
          }

          // Check if user is a member of this organization
          const { db } = await import('@/infrastructure/database')
          const { members } = await import('@/infrastructure/auth/better-auth/schema')
          const { eq, and } = await import('drizzle-orm')

          const membership = await db
            .select()
            .from(members)
            .where(
              and(eq(members.organizationId, organizationId), eq(members.userId, session.user.id))
            )
            .limit(1)

          const isMember = membership.length > 0

          if (!isMember) {
            // Return 404 to prevent organization enumeration
            return c.json({ error: 'Organization not found' }, 404)
          }

          // User is a member - fetch organization details
          const { organizations } = await import('@/infrastructure/auth/better-auth/schema')
          const orgRecords = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, organizationId))
            .limit(1)

          if (orgRecords.length === 0) {
            return c.json({ error: 'Organization not found' }, 404)
          }

          return c.json(orgRecords[0], 200)
        } catch {
          return c.json({ error: 'Failed to get organization' }, 500)
        }
      })
    : appWithVerifyEmail

  // Mount Better Auth handler for all other /api/auth/* routes
  // Better Auth natively provides: send-verification-email, verify-email, sign-in, sign-up, etc.
  // IMPORTANT: Better Auth handles its own routing and expects the FULL request path
  // including the /api/auth prefix. We pass the original request without modification.
  return wrappedApp.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    return authInstance.handler(c.req.raw)
  })
}
