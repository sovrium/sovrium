/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Scalar } from '@scalar/hono-api-reference'
import { type Hono } from 'hono'
import { auth } from '@/infrastructure/auth/better-auth/auth'
import { getOpenAPIDocument } from '@/infrastructure/server/route-setup/openapi-schema'

/**
 * Setup OpenAPI documentation routes
 *
 * Mounts:
 * - GET /api/openapi.json - Application API schema
 * - GET /api/auth/openapi.json - Better Auth API schema
 * - GET /api/scalar - Unified Scalar API documentation UI
 *
 * @param honoApp - Hono application instance
 * @returns Hono app with OpenAPI routes configured
 */
export function setupOpenApiRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return honoApp
    .get('/api/openapi.json', (c) => {
      const openApiDoc = getOpenAPIDocument()
      return c.json(openApiDoc)
    })
    .get('/api/auth/openapi.json', async (c) => {
      const authOpenApiDoc = await auth.api.generateOpenAPISchema()
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
