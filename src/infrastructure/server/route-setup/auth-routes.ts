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
 * Setup CORS middleware for Better Auth endpoints
 *
 * Configures CORS to allow:
 * - All localhost origins for development/testing
 * - Credentials for cookie-based authentication
 * - Common headers and methods
 *
 * @param honoApp - Hono application instance
 * @returns Hono app with CORS middleware configured
 */
export function setupAuthMiddleware(honoApp: Readonly<Hono>): Readonly<Hono> {
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
 * @param honoApp - Hono application instance
 * @param app - Application configuration with auth settings
 * @returns Hono app with auth routes configured
 */
export function setupAuthRoutes(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  // Debug: Log the app config being passed
  console.error(
    '[AUTH-ROUTES] setupAuthRoutes called with app?.auth:',
    JSON.stringify(app?.auth, null, 2)
  )

  // Create Better Auth instance with app-specific configuration (once per app startup)
  // This instance is reused across all requests to maintain internal state
  const authInstance = createAuthInstance(app?.auth)

  // Mount Better Auth handler for all /api/auth/* routes
  // Better Auth natively provides: send-verification-email, verify-email, sign-in, sign-up, etc.
  return honoApp.on(['POST', 'GET'], '/api/auth/*', (c) => authInstance.handler(c.req.raw))
}
