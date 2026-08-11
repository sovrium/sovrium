/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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

type GuardContext = Parameters<Parameters<Hono['use']>[1]>[0]

// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is mutable by library design
const unauthorizedResponse = (c: GuardContext) =>
  c.json(
    {
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    },
    401
  )

// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is mutable by library design
const notFoundResponse = (c: GuardContext) =>
  c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)

/**
 * Create admin-only auth guard for OpenAPI endpoints.
 *
 * Per S1 anti-enumeration:
 * authorization denials (authenticated but not admin) return **404** so the
 * caller cannot distinguish "endpoint exists, you lack access" from "endpoint
 * doesn't exist". Authentication denials remain **401** (standard HTTP
 * semantics — S1 applies to authz, not authn).
 *
 * Authorization is decided by the canonical, custom-role-aware
 * {@link isAdminTier} predicate (threading the live `app`) rather than a literal
 * `role === 'admin'` check: any role that resolves to a dashboard tier — including
 * a partner-style custom TOP role (e.g. `engineer`, level 80, which resolves to
 * `admin-editor` via rule 5) — is admin-tier and passes. This mirrors the
 * `requireAdminTier`/`makeAdminGuard` posture in
 * `src/presentation/api/middleware/auth.ts`. Built-in `admin` still passes; a
 * plain `member` still 404s.
 */
function createAdminGuard(authInstance: Readonly<ReturnType<typeof createAuthInstance>>, app: App) {
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is mutable by library design
  return async (c: GuardContext, next: () => Promise<void>) => {
    try {
      const authHeader = c.req.header('authorization')
      const headers = authHeader?.toLowerCase().startsWith('bearer ')
        ? new Headers({ authorization: authHeader.slice(7) })
        : c.req.raw.headers

      const sessionResult = (await authInstance.api.getSession({ headers })) as {
        readonly session?: { readonly userId: string }
      } | null

      if (!sessionResult?.session) {
        return unauthorizedResponse(c)
      }

      // Lazy imports to avoid database / domain initialization at import time
      // (mirrors makeAdminGuard in the presentation middleware).
      const { getUserRole } = await import('@/application/use-cases/tables/user-role')
      const { isAdminTier } = await import('@/domain/models/app')
      const role = await getUserRole(sessionResult.session.userId)

      if (!isAdminTier(role, app)) {
        return notFoundResponse(c)
      }

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    } catch (error) {
      logError('[OpenAPI Auth] Session check error', error)
      return unauthorizedResponse(c)
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
  const adminGuard = createAdminGuard(authInstance, app)

  return honoApp
    .use('/api/openapi.json', adminGuard)
    .use('/api/auth/openapi.json', adminGuard)
    .use('/api/scalar', adminGuard)
    .get('/api/openapi.json', (c) => {
      const openApiDoc = getOpenAPIDocument(app)
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
