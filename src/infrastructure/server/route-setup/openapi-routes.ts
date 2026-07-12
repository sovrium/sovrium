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

function createAdminGuard(authInstance: Readonly<ReturnType<typeof createAuthInstance>>, app: App) {
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

      const { getUserRole } = await import('@/application/use-cases/tables/user-role')
      const { isAdminTier } = await import('@/domain/models/app')
      const role = await getUserRole(sessionResult.session.userId)

      if (!isAdminTier(role, app)) {
        return notFoundResponse(c)
      }

      await next()
    } catch (error) {
      logError('[OpenAPI Auth] Session check error', error)
      return unauthorizedResponse(c)
    }
  }
}

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
