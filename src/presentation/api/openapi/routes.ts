/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Scalar } from '@scalar/hono-api-reference'
import { type Hono } from 'hono'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getOpenAPIDocument } from '@/presentation/api/openapi/document'
import {
  resolveCallerTier,
  type ReadUserRole,
  type SessionReader,
} from '@/presentation/api/runtime/caller-tier'
import { resolveRequestBaseUrl } from '../../../domain/kernel/url/request-base-url'
import type { App } from '@/domain/models/app'
// Type-only: the instance is built once in `createHonoApp` and passed in, so
// this module never loads the Better Auth package.
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'

type GuardContext = Parameters<Parameters<Hono['use']>[1]>[0]

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

const notFoundResponse = (c: GuardContext) =>
  c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)

/**
 * The role lookup, bound to this request's domain runtime. Lazily imported so
 * mounting the routes initialises no database.
 */
const readUserRoleInRequest =
  (c: GuardContext): ReadUserRole =>
  async (userId) => {
    const { getUserRole } = await import('@/application/use-cases/tables/user-role')
    return runDomainPromise(c, getUserRole(userId))
  }

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
 *
 * The tier itself comes from {@link resolveCallerTier}, the same resolver the
 * health endpoint reads, so the two cannot disagree about who is an admin. A
 * failure to resolve it refuses with 401.
 */
export function createAdminGuard(
  authInstance: SessionReader,
  app: App,
  readRoleFor: (c: GuardContext) => ReadUserRole = readUserRoleInRequest
) {
  return async (c: GuardContext, next: () => Promise<void>) => {
    try {
      const tier = await resolveCallerTier(c, authInstance, app, readRoleFor(c))
      if (tier === 'anonymous') return unauthorizedResponse(c)
      if (tier === 'non-admin') return notFoundResponse(c)
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
export function setupOpenApiRoutes(
  honoApp: Readonly<Hono>,
  app?: App,
  authInstance?: Readonly<ReturnType<typeof createAuthInstance>>
): Readonly<Hono> {
  if (!app?.auth || !authInstance) {
    return honoApp
  }

  const adminGuard = createAdminGuard(authInstance, app)

  return honoApp
    .use('/api/openapi.json', adminGuard)
    .use('/api/auth/openapi.json', adminGuard)
    .use('/api/scalar', adminGuard)
    .get('/api/openapi.json', (c) => {
      const openApiDoc = getOpenAPIDocument(app)
      // The advertised server is resolved PER REQUEST and applied on a shallow
      // copy — never written into the document itself. `getOpenAPIDocument` is
      // memoized per `App` in a `WeakMap`, and that reference identity is a
      // contract (`openapi-schema.test.ts`); folding a per-request origin into
      // the builder would defeat the cache and rebuild the whole schema on every
      // hit. A single entry, because the document names ONE instance: this one.
      return c.json({
        ...openApiDoc,
        servers: [{ url: resolveRequestBaseUrl(c), description: 'This instance' }],
      })
    })
    .get('/api/auth/openapi.json', async (c) => {
      const authOpenApiDoc = await authInstance.api.generateOpenAPISchema()
      return c.json(authOpenApiDoc)
    })
    .get(
      '/api/scalar',
      Scalar({
        pageTitle: `${app.name} API reference`,
        theme: 'default',
        // The reference is the app's, so the vendor's outbound controls are off:
        // no client-download promotion, no models panel, no AI assistant or MCP
        // control, no usage telemetry and no web-font fetch. The whole object is
        // serialised into the page with JSON.stringify, so every option here
        // must stay a plain value — a function would not survive the trip.
        hideClientButton: true,
        hideModels: true,
        agent: { disabled: true },
        mcp: { disabled: true },
        telemetry: false,
        withDefaultFonts: false,
        sources: [
          { url: '/api/openapi.json', title: 'API' },
          { url: '/api/auth/openapi.json', title: 'Auth' },
        ],
      })
    )
}
