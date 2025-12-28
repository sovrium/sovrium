/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { authMiddleware } from '@/presentation/api/middleware/auth'
import { chainTableRoutes, chainAuthRoutes, chainActivityRoutes } from '@/presentation/api/routes'
import {
  healthResponseSchema,
  type HealthResponse,
} from '@/presentation/api/schemas/health-schemas'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

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
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
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
        catch: (error) => new Error(`Health response validation failed: ${error}`),
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

  // Apply auth middleware to protected routes (conditionally based on tables config)
  // This extracts session from Better Auth and attaches to context
  const honoWithAuth = app.tables
    ? honoWithHealth
        .use('/api/tables', authMiddleware(auth))
        .use('/api/tables/*', authMiddleware(auth))
        .use('/api/activity', authMiddleware(auth))
    : honoWithHealth.use('/api/activity', authMiddleware(auth))

  // Chain table routes ONLY if tables are configured
  // Routes now have access to session via c.var.session
  // Pass app configuration for table metadata lookup (tableId → table name mapping)
  const honoWithTables = app.tables ? chainTableRoutes(honoWithAuth, app) : honoWithAuth

  // Chain activity routes (activity log access)
  const honoWithActivity = chainActivityRoutes(honoWithTables)

  // Chain auth routes (role manipulation prevention)
  return chainAuthRoutes(honoWithActivity, auth)
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
