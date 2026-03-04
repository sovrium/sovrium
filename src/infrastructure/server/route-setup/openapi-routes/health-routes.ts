/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { healthResponseSchema } from '@/domain/models/api/health'

/**
 * Register health check routes for OpenAPI schema generation
 */
export function registerHealthRoutes(app: OpenAPIHono): void {
  const healthRoute = createRoute({
    method: 'get',
    path: '/api/health',
    summary: 'Health check endpoint',
    description:
      'Returns server health status. Used by monitoring tools and E2E tests to verify server is running.',
    operationId: 'healthCheck',
    tags: ['infrastructure'],
    responses: {
      200: {
        content: { 'application/json': { schema: healthResponseSchema } },
        description: 'Server is healthy',
      },
    },
  })

  app.openapi(healthRoute, (c) => {
    return c.json({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      app: { name: 'Sovrium' },
    })
  })
}
