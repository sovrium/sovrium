/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Scalar } from '@scalar/hono-api-reference'
import { type Hono } from 'hono'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { logError } from '@/infrastructure/logging/logger'
import { getOpenAPIDocument } from '@/infrastructure/server/route-setup/openapi-schema'
import type { App } from '@/domain/models/app'

/**
 * Create admin-only auth guard for OpenAPI endpoints.
 *
 * Returns 401 for unauthenticated requests, 403 for non-admin users.
 * Uses inline session check (same pattern as auth-routes.ts).
 */
function createAdminGuard(authInstance: Readonly<ReturnType<typeof createAuthInstance>>) {
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is mutable by library design
  return async (c: Parameters<Parameters<Hono['use']>[1]>[0], next: () => Promise<void>) => {
    try {
      const authHeader = c.req.header('authorization')
      const headers = authHeader?.toLowerCase().startsWith('bearer ')
        ? new Headers({ authorization: authHeader.slice(7) })
        : c.req.raw.headers

      const sessionResult = (await authInstance.api.getSession({ headers })) as {
        readonly session?: { readonly userId: string }
      } | null

      if (!sessionResult?.session) {
        return c.json(
          {
            success: false,
            error: 'Unauthorized',
            message: 'Authentication required',
            code: 'UNAUTHORIZED',
          },
          401
        )
      }

      const { getUserRole } = await import('@/application/use-cases/tables/user-role')
      const role = await getUserRole(sessionResult.session.userId)

      if (role !== 'admin') {
        return c.json(
          {
            success: false,
            error: 'Forbidden',
            message: 'Admin access required',
            code: 'FORBIDDEN',
          },
          403
        )
      }

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    } catch (error) {
      logError('[OpenAPI Auth] Session check error', error)
      return c.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        401
      )
    }
  }
}

/**
 * Setup OpenAPI documentation routes (admin-only)
 *
 * When auth is configured, mounts admin-protected routes:
 * - GET /api/openapi.json - Application API schema
 * - GET /api/auth/openapi.json - Better Auth API schema
 * - GET /api/scalar - Unified Scalar API documentation UI
 *
 * When auth is NOT configured, returns the app unchanged (all 3 return 404).
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration (optional, for auth check)
 * @returns Hono app with OpenAPI routes configured (or unchanged if no auth)
 */
export function setupOpenApiRoutes(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  if (!app?.auth) {
    return honoApp
  }

  const authInstance = createAuthInstance(app.auth)
  const adminGuard = createAdminGuard(authInstance)

  return honoApp
    .use('/api/openapi.json', adminGuard)
    .use('/api/auth/openapi.json', adminGuard)
    .use('/api/scalar', adminGuard)
    .get('/api/openapi.json', (c) => {
      const openApiDoc = getOpenAPIDocument()
      return c.json(openApiDoc)
    })
    .get('/api/auth/openapi.json', async (c) => {
      const authOpenApiDoc = await authInstance.api.generateOpenAPISchema()
      return c.json(authOpenApiDoc)
    })
    .get(
      '/api/scalar',
      Scalar({
        pageTitle: 'Sovrium API Documentation',
        theme: 'default',
        sources: [
          { url: '/api/openapi.json', title: 'API' },
          { url: '/api/auth/openapi.json', title: 'Auth' },
        ],
      })
    )
}
