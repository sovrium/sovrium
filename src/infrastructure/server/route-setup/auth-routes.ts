/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { isRateLimitExceeded, recordRateLimitRequest, extractClientIp } from './auth-route-utils'
import type { App } from '@/domain/models/app'

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
 * Mounts Better Auth handler at /api/auth/* which provides all authentication endpoints.
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
 * Better Auth natively provides:
 * - Authentication: sign-up, sign-in, sign-out, verify-email, send-verification-email
 * - Admin Plugin: list-users, get-user, set-role, ban-user, unban-user, impersonate-user, stop-impersonating
 * - Organization Plugin: create-organization, list-organizations, get-organization, set-active-organization
 * - Two-Factor: enable, disable, verify
 * - Magic Link: send, verify
 *
 * Native Better Auth handles:
 * - Banned user rejection (automatic in admin plugin)
 * - Single-use verification tokens (automatic)
 * - Admin role validation (via adminRoles/adminUserIds config)
 * - Organization membership validation (automatic)
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration with auth settings
 * @returns Hono app with auth routes configured (or unchanged if auth is disabled)
 */
export function setupAuthRoutes(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  // If no auth config is provided, don't register any auth routes
  // This causes all /api/auth/* requests to return 404 (not found)
  if (!app?.auth) {
    return honoApp
  }

  // Create Better Auth instance with app-specific configuration (once per app startup)
  // This instance is reused across all requests to maintain internal state
  const authInstance = createAuthInstance(app.auth)

  // Apply rate limiting middleware to admin routes (if admin plugin is enabled)
  const appWithRateLimit = app.auth.admin ? applyRateLimitMiddleware(honoApp) : honoApp

  // Custom handler for stop-impersonating to ensure proper session restoration
  // Better Auth's native implementation doesn't properly restore the admin session cookie
  const appWithStopImpersonating = appWithRateLimit.post(
    '/api/auth/admin/stop-impersonating',
    async (c) => {
      const session = await authInstance.api.getSession({ headers: c.req.raw.headers })

      // If not authenticated, return 401
      if (!session) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      // If not impersonating, return 400
      if (!session.session.impersonatedBy) {
        return c.json({ error: 'Not currently impersonating anyone' }, 400)
      }

      const adminUserId = session.session.impersonatedBy
      const { db } = await import('@/infrastructure/database')
      const { sessions } = await import('@/infrastructure/auth/better-auth/schema')
      const { eq } = await import('drizzle-orm')

      // Delete the impersonation session
      await db.delete(sessions).where(eq(sessions.id, session.session.id))

      // Always create a new session for the admin when stopping impersonation
      // Better Auth deletes the original admin session when impersonation starts
      const now = new Date()
      const newSessionId = crypto.randomUUID()
      const newSessionToken = crypto.randomUUID().replace(/-/g, '')
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

      await db.insert(sessions).values({
        id: newSessionId,
        userId: adminUserId,
        token: newSessionToken,
        expiresAt,
        ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
        userAgent: c.req.header('user-agent') ?? 'unknown',
      })

      // Set the new session cookie
      c.header(
        'Set-Cookie',
        `better-auth.session_token=${newSessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      )

      return c.json({
        success: true,
        message: 'Impersonation ended, admin session restored',
        adminUserId,
        newSessionToken,
      })
    }
  )

  // Mount Better Auth handler for all other /api/auth/* routes
  // Better Auth natively handles:
  // - Authentication flows (sign-up, sign-in, sign-out, email verification)
  // - Admin operations (list-users, get-user, set-role, ban-user, impersonation)
  // - Organization management (create, list, get, set-active, invite members)
  // - Two-factor authentication (enable, disable, verify)
  // - Magic link authentication (send, verify)
  // - Banned user rejection (automatic for admin plugin)
  // - Single-use verification tokens (automatic)
  //
  // IMPORTANT: Better Auth handles its own routing and expects the FULL request path
  // including the /api/auth prefix. We pass the original request without modification.
  return appWithStopImpersonating.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    return authInstance.handler(c.req.raw)
  })
}
