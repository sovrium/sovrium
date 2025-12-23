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
// eslint-disable-next-line max-lines-per-function -- Minimal implementation requires route wrappers and handlers
export function setupAuthRoutes(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  // If no auth config is provided, don't register any auth routes
  // This causes all /api/auth/* requests to return 404 (not found)
  if (!app?.auth) {
    return honoApp
  }

  // Create Better Auth instance with app-specific configuration (once per app startup)
  // This instance is reused across all requests to maintain internal state
  const authInstance = createAuthInstance(app.auth)

  // Wrap verify-email to enforce single-use tokens
  const wrappedApp = honoApp.get('/api/auth/verify-email', async (c) => {
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

    const metadataString =
      typeof metadata === 'object' && metadata !== null
        ? JSON.stringify(metadata)
        : String(metadata ?? '')

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
  const finalApp = app.auth.plugins?.apiKeys
    ? wrappedApp.post('/api/auth/api-key/create', async (c) => {
        try {
          const body = await c.req.json()

          // If metadata is provided, handle it separately
          if (body.metadata) {
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

  // Mount Better Auth handler for all /api/auth/* routes
  // Better Auth expects the full path including /api/auth prefix
  // See: https://www.better-auth.com/docs/integrations/hono
  return finalApp.on(['POST', 'GET'], '/api/auth/*', (c) => authInstance.handler(c.req.raw))
}
