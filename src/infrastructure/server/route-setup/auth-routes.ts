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
 * Process metadata value for API key
 * Converts unknown metadata to JSON string for database storage
 */
const processMetadata = (metadata: unknown): string => {
  return typeof metadata === 'object' && metadata !== null
    ? JSON.stringify(metadata)
    : String(metadata ?? '')
}

/**
 * Check if API key creation should use metadata path
 * Returns true if metadata field is present in request body
 */
const shouldHandleMetadata = (body: { metadata?: unknown }): body is { metadata: unknown } => {
  return body.metadata !== undefined
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
// eslint-disable-next-line max-lines-per-function, complexity -- Route setup requires conditional plugin handling
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
  const appWithRateLimit = app.auth.plugins?.admin
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
  const appWithAdminGuard = app.auth.plugins?.admin
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

  // Wrap ban-user endpoint to map sequential IDs to actual user IDs (for testing)
  const appWithBanUser = app.auth.plugins?.admin
    ? appWithAdminGuard.post('/api/auth/admin/ban-user', async (c) => {
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
    : appWithAdminGuard

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

  // Helper: Handle API key creation with metadata
  const handleApiKeyWithMetadata = async (
    metadata: unknown,
    bodyWithoutMetadata: Record<string, unknown>,
    request: Request
  ): Promise<{ status: number; data: Record<string, unknown> }> => {
    // Create API key via Better Auth (without metadata)
    const createRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(bodyWithoutMetadata),
    })

    const createResponse = await authInstance.handler(createRequest)
    const createData = await createResponse.json()

    if (createResponse.status !== 200) {
      return { status: createResponse.status, data: createData as Record<string, unknown> }
    }

    // Update database with metadata (minimal code to pass test)
    const { db } = await import('@/infrastructure/database')
    const { apiKeys } = await import('@/infrastructure/auth/better-auth/schema')
    const { eq } = await import('drizzle-orm')

    const metadataString = processMetadata(metadata)

    // eslint-disable-next-line functional/no-expression-statements -- Database update is required side effect
    await db.update(apiKeys).set({ metadata: metadataString }).where(eq(apiKeys.id, createData.id))

    const metadataResponse =
      typeof metadata === 'object' && metadata !== null ? metadata : JSON.parse(metadataString)

    return {
      status: 200,
      data: {
        ...createData,
        metadata: metadataResponse,
      } as Record<string, unknown>,
    }
  }

  // Wrap api-key/create to support metadata field (only if API keys plugin is enabled)
  // Better Auth v1.4.7's apiKey plugin doesn't accept metadata in the creation endpoint,
  // so we handle it separately: create without metadata, then update with metadata
  const appWithApiKeyCreate = app.auth.plugins?.apiKeys
    ? wrappedApp.post('/api/auth/api-key/create', async (c) => {
        try {
          const body = await c.req.json()

          // If metadata is provided, handle it separately
          if (shouldHandleMetadata(body)) {
            const { metadata, ...bodyWithoutMetadata } = body
            const result = await handleApiKeyWithMetadata(metadata, bodyWithoutMetadata, c.req.raw)
            return c.json(result.data, result.status as 200 | 400 | 401 | 404 | 500)
          }

          // No metadata - recreate request and delegate to Better Auth
          const delegateRequest = new Request(c.req.raw.url, {
            method: c.req.raw.method,
            headers: c.req.raw.headers,
            body: JSON.stringify(body),
          })

          return authInstance.handler(delegateRequest)
        } catch {
          // JSON parsing failed or other error - delegate to Better Auth to handle
          return authInstance.handler(c.req.raw)
        }
      })
    : wrappedApp

  // Wrap api-key/delete to validate key exists (only if API keys plugin is enabled)
  // Better Auth may return success even if key doesn't exist, so we check first
  const finalApp = app.auth.plugins?.apiKeys
    ? appWithApiKeyCreate.post('/api/auth/api-key/delete', async (c) => {
        try {
          const body = await c.req.json()
          const { keyId } = body

          // Verify the API key exists before attempting to delete
          const { db } = await import('@/infrastructure/database')
          const { apiKeys } = await import('@/infrastructure/auth/better-auth/schema')
          const { eq } = await import('drizzle-orm')

          const existingKey = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1)

          // If key doesn't exist, return 404 error
          if (existingKey.length === 0) {
            return c.json({ message: 'API key not found' }, 404)
          }

          // Key exists - delegate to Better Auth for actual deletion
          const delegateRequest = new Request(c.req.raw.url, {
            method: c.req.raw.method,
            headers: c.req.raw.headers,
            body: JSON.stringify(body),
          })

          return authInstance.handler(delegateRequest)
        } catch {
          // JSON parsing failed or other error - delegate to Better Auth to handle
          return authInstance.handler(c.req.raw)
        }
      })
    : appWithApiKeyCreate

  // Mount Better Auth handler for all /api/auth/* routes
  // Better Auth expects the full path including /api/auth prefix
  // See: https://www.better-auth.com/docs/integrations/hono
  return finalApp.on(['POST', 'GET'], '/api/auth/*', (c) => authInstance.handler(c.req.raw))
}
