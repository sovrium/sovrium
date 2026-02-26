/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data } from 'effect'
import { healthResponseSchema, type HealthResponse } from '@/domain/models/api/health'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { authMiddleware, requireAuth } from '@/presentation/api/middleware/auth'
import {
  chainTableRoutes,
  chainAuthRoutes,
  chainActivityRoutes,
  chainAnalyticsRoutes,
} from '@/presentation/api/routes'
import {
  extractClientIp,
  isTablesRateLimitExceeded,
  recordTablesRateLimitRequest,
  getTablesRateLimitRetryAfter,
  isActivityRateLimitExceeded,
  recordActivityRateLimitRequest,
  getActivityRateLimitRetryAfter,
} from './auth-route-utils'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Error when health response validation fails
 */
class HealthResponseValidationError extends Data.TaggedError('HealthResponseValidationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Apply rate limiting middleware for table API endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
const applyTablesRateLimitMiddleware = (honoApp: Hono): Hono => {
  return honoApp
    .use('/api/tables', async (c, next) => {
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
      const { method } = c.req
      const path = '/api/tables'

      if (isTablesRateLimitExceeded(method, path, ip)) {
        const retryAfter = getTablesRateLimitRetryAfter(method, path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordTablesRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
    .use('/api/tables/*', async (c, next) => {
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
      const { method } = c.req
      const { path } = c.req

      if (isTablesRateLimitExceeded(method, path, ip)) {
        const retryAfter = getTablesRateLimitRetryAfter(method, path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordTablesRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
}

/**
 * Apply rate limiting middleware for activity API endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
const applyActivityRateLimitMiddleware = (honoApp: Hono): Hono => {
  return honoApp
    .use('/api/activity', async (c, next) => {
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
      const { method } = c.req
      const path = '/api/activity'

      if (isActivityRateLimitExceeded(method, path, ip)) {
        const retryAfter = getActivityRateLimitRetryAfter(method, path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordActivityRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
    .use('/api/activity/*', async (c, next) => {
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
      const { method } = c.req
      const { path } = c.req

      if (isActivityRateLimitExceeded(method, path, ip)) {
        const retryAfter = getActivityRateLimitRetryAfter(method, path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordActivityRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
}

/**
 * Create API routes using method chaining pattern
 *
 * Located in Infrastructure layer because this is route composition/wiring
 * (infrastructure concern), not route handler logic (presentation concern).
 *
 * **Why Chaining?**
 * Hono RPC requires method chaining (not .route() mounting) for proper type inference.
 * This allows the RPC client to extract route types automatically.
 *
 * **Pattern**:
 * ```typescript
 * const app = new Hono()
 *   .get('/api/health', handler)
 *   .get('/api/users/:id', handler)
 *   .post('/api/users', handler)
 * ```
 *
 * **Why Not .route()?**
 * ```typescript
 * // ❌ This breaks RPC type inference
 * app.route('/api', subApp)
 * ```
 *
 * See: https://hono.dev/docs/guides/best-practices#building-a-larger-application
 *
 * @param app - Validated application configuration from AppSchema
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with all API routes chained
 */
// eslint-disable-next-line functional/prefer-immutable-types, max-lines-per-function -- Hono types are mutable by library design; function composes middleware chain and requires activity auth setup
export const createApiRoutes = <T extends Hono>(app: App, honoApp: T) => {
  // Create Better Auth instance for middleware
  const auth = createAuthInstance(app.auth)

  // Create health check endpoint
  const honoWithHealth = honoApp.get('/api/health', async (c) => {
    // Use Effect.gen for functional composition
    const program = Effect.gen(function* () {
      // Build health response (explicitly typed for Zod validation)
      // eslint-disable-next-line functional/prefer-immutable-types -- Required for Zod schema validation
      const response: HealthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        app: {
          name: app.name,
        },
      }

      // Validate response against schema (ensures type safety)
      const validated = yield* Effect.try({
        try: () => healthResponseSchema.parse(response),
        catch: (error) =>
          new HealthResponseValidationError({
            message: `Health response validation failed: ${error}`,
            cause: error,
          }),
      })

      return validated
    })

    try {
      // Run Effect program and return result
      const data = await Effect.runPromise(program)
      return c.json(data, 200)
    } catch {
      // Handle errors gracefully
      return c.json(
        {
          error: 'Internal server error',
          code: 'HEALTH_CHECK_FAILED',
        },
        500
      )
    }
  })

  // Apply rate limiting middleware BEFORE auth middleware
  // This prevents auth bypass by rate limiting all requests first
  // Middleware order: rate limiting → authMiddleware (extracts session) → requireAuth (enforces auth)
  const honoWithTablesRateLimit = applyTablesRateLimitMiddleware(honoWithHealth)
  const honoWithActivityRateLimit = applyActivityRateLimitMiddleware(honoWithTablesRateLimit)

  // Apply auth middleware to protected routes
  // This extracts session from Better Auth and attaches to context
  // Activity endpoints ALWAYS require authentication (even when app.auth is not configured)
  // Table endpoints only require authentication if auth is configured
  // Analytics query endpoints require authentication; collect endpoint is public
  const honoWithAuth = app.auth
    ? honoWithActivityRateLimit
        .use('/api/tables', authMiddleware(auth))
        .use('/api/tables', requireAuth())
        .use('/api/tables/*', authMiddleware(auth))
        .use('/api/tables/*', requireAuth())
        .use('/api/activity', authMiddleware(auth))
        .use('/api/activity', requireAuth())
        .use('/api/activity/*', authMiddleware(auth))
        .use('/api/activity/*', requireAuth())
        .use('/api/analytics/overview', authMiddleware(auth))
        .use('/api/analytics/overview', requireAuth())
        .use('/api/analytics/pages', authMiddleware(auth))
        .use('/api/analytics/pages', requireAuth())
        .use('/api/analytics/referrers', authMiddleware(auth))
        .use('/api/analytics/referrers', requireAuth())
        .use('/api/analytics/devices', authMiddleware(auth))
        .use('/api/analytics/devices', requireAuth())
        .use('/api/analytics/campaigns', authMiddleware(auth))
        .use('/api/analytics/campaigns', requireAuth())
    : honoWithActivityRateLimit
        .use('/api/activity', requireAuth())
        .use('/api/activity/*', requireAuth())
        .use('/api/analytics/overview', requireAuth())
        .use('/api/analytics/pages', requireAuth())
        .use('/api/analytics/referrers', requireAuth())
        .use('/api/analytics/devices', requireAuth())
        .use('/api/analytics/campaigns', requireAuth())

  // Chain table routes (always register, returns empty array if no tables configured)
  // Routes now have access to session via c.var.session
  // Pass app configuration for table metadata lookup (tableId → table name mapping)
  const honoWithTables = chainTableRoutes(honoWithAuth, app)

  // Chain activity routes (activity log access)
  const honoWithActivity = chainActivityRoutes(honoWithTables)

  // Chain analytics routes (page view collection + query endpoints)
  // Extract retentionDays from analytics config for retention cleanup on collect
  const retentionDays = typeof app.analytics === 'object' ? app.analytics.retentionDays : undefined
  const honoWithAnalytics = chainAnalyticsRoutes(honoWithActivity, app.name, retentionDays)

  // Chain auth routes (role manipulation prevention)
  return chainAuthRoutes(honoWithAnalytics, auth)
}

/**
 * Type export for Hono RPC client
 *
 * This type is used by the RPC client to provide full type safety
 * and autocomplete for API calls on the frontend.
 *
 * **Important**: This type must be extracted from the chained result,
 * not from a sub-app mounted with .route()
 *
 * @example
 * ```typescript
 * import { hc } from 'hono/client'
 * import type { ApiType } from '@/infrastructure/server/route-setup/api-routes'
 *
 * const client = hc<ApiType>('http://localhost:3000')
 * const res = await client.api.health.$get()
 * const data = await res.json() // Fully typed HealthResponse!
 * ```
 */
export type ApiType = ReturnType<typeof createApiRoutes<Hono>>
