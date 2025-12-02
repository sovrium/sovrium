/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from '@/infrastructure/auth/better-auth/auth'
import { db } from '@/infrastructure/database/drizzle/db'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { eq } from 'drizzle-orm'

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
 * Setup Better Auth routes
 *
 * Mounts Better Auth handler at /api/auth/* and adds custom endpoints.
 *
 * Custom endpoints:
 * - POST /api/auth/send-verification-email - Public endpoint to send verification emails
 *
 * @param honoApp - Hono application instance
 * @returns Hono app with auth routes configured
 */
export function setupAuthRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  // Add custom send-verification-email endpoint BEFORE the wildcard Better Auth handler
  // This endpoint is public (no auth required) and prevents email enumeration
  const honoWithCustomAuth = honoApp.post('/api/auth/send-verification-email', async (c) => {
    try {
      // Parse request body
      const body = await c.req.json()
      const email = body.email

      // Validate email is provided
      if (!email || typeof email !== 'string') {
        return c.json({ message: 'Email is required' }, 400)
      }

      // Basic email format validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return c.json({ message: 'Invalid email format' }, 400)
      }

      // Check if user exists (prevent email enumeration by always returning 200)
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      })

      // If user exists and email not verified, send verification email
      if (user && !user.emailVerified) {
        // Call Better Auth's sendVerificationEmail function
        // This will use the sendVerificationEmail callback configured in auth.ts
        await auth.api.sendVerificationEmail({
          body: {
            email: user.email,
            callbackURL: `${c.req.header('origin') || process.env.BETTER_AUTH_BASE_URL || 'http://localhost:3000'}/api/auth/verify-email`,
          },
        })
      }

      // Always return 200 OK to prevent email enumeration
      return c.json({ status: true }, 200)
    } catch (error) {
      // Log error but still return 200 to prevent enumeration
      console.error('[send-verification-email] Error:', error)
      return c.json({ status: true }, 200)
    }
  })

  // Mount Better Auth handler for all other /api/auth/* routes
  return honoWithCustomAuth.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))
}
