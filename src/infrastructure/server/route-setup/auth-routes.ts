/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import {
  isRateLimitExceeded,
  recordRateLimitRequest,
  extractClientIp,
  isAuthRateLimitExceeded,
  recordAuthRateLimitRequest,
} from './auth-route-utils'
import type { App } from '@/domain/models/app'

/**
 * Apply authentication check middleware for admin endpoints
 *
 * This middleware ensures authentication is checked BEFORE parameter validation,
 * preventing information leakage through error responses (400/404/403 vs 401).
 *
 * Without this middleware, Better Auth's admin endpoints validate parameters first,
 * allowing unauthenticated users to probe for valid user IDs by observing response codes.
 *
 * Returns a Hono app with authentication middleware applied
 */
const applyAuthCheckMiddleware = (honoApp: Readonly<Hono>, authInstance: any): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    try {
      // Check if request has a valid session cookie
      const session = await authInstance.api.getSession({
        headers: c.req.raw.headers,
      })

      // Return 401 if no valid session (BEFORE any parameter validation)
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }

      // Session exists - proceed to next handler
      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    } catch (error) {
      // If session check fails, return 401 (assume unauthenticated)
      console.error('[Auth Middleware] Session check error:', error)
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
    }
  })
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
 * Apply rate limiting middleware for authentication endpoints
 *
 * Protects security-critical authentication endpoints from brute force attacks:
 * - sign-in: 5 attempts per 60 seconds (prevent credential stuffing)
 * - sign-up: 5 attempts per 60 seconds (prevent account creation abuse)
 * - request-password-reset: 3 attempts per 60 seconds (prevent email enumeration)
 *
 * Returns a Hono app with rate limiting middleware applied
 */
const applyAuthRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  const endpoints = [
    '/api/auth/sign-in/email',
    '/api/auth/sign-up/email',
    '/api/auth/request-password-reset',
  ]

  let result = honoApp
  for (const endpoint of endpoints) {
    result = result.use(endpoint, async (c, next) => {
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
      const path = c.req.path

      if (isAuthRateLimitExceeded(path, ip)) {
        return c.json(
          { error: 'Too many requests', message: 'Too many requests' },
          429,
          { 'Retry-After': '60' } // Retry after 60 seconds (window duration)
        )
      }

      recordAuthRateLimitRequest(path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
  }

  return result
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

  // Apply authentication check middleware first (if admin plugin is enabled)
  // This ensures 401 is returned before any parameter validation, preventing information leakage
  const appWithAuthCheck = app.auth.admin
    ? applyAuthCheckMiddleware(honoApp, authInstance)
    : honoApp

  // Apply rate limiting middleware to admin routes (if admin plugin is enabled)
  const appWithAdminRateLimit = app.auth.admin
    ? applyRateLimitMiddleware(appWithAuthCheck)
    : appWithAuthCheck

  // Apply rate limiting middleware to authentication endpoints (sign-in, sign-up, password reset)
  const appWithAuthRateLimit = applyAuthRateLimitMiddleware(appWithAdminRateLimit)

  // Mount Better Auth handler for all /api/auth/* routes
  // Better Auth natively handles:
  // - Authentication flows (sign-up, sign-in, sign-out, email verification)
  // - Admin operations (list-users, get-user, set-role, ban-user, impersonation)
  // - Organization management (create, list, get, set-active, invite members)
  // - Two-factor authentication (enable, disable, verify)
  // - Magic link authentication (send, verify)
  // - Banned user rejection (automatic for admin plugin)
  // - Single-use verification tokens (automatic)
  // - Team operations (create-team, add-team-member, etc.) when teams plugin enabled
  //
  // IMPORTANT: Better Auth handles its own routing and expects the FULL request path
  // including the /api/auth prefix. We pass the original request without modification.
  return appWithAuthRateLimit.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    return authInstance.handler(c.req.raw)
  })
}
