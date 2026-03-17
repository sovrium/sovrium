/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  getActivityLogResponseSchema,
  listActivityLogsResponseSchema,
} from '@/domain/models/api/activity'
import { errorResponseSchema } from '@/domain/models/api/error'
import { activityIdParamSchema, activityQuerySchema } from '@/domain/models/api/params'

/**
 * Register activity log routes for OpenAPI schema generation
 */
export function registerActivityRoutes(app: OpenAPIHono): void {
  // GET /api/activity
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/activity',
      summary: 'List activity logs',
      description:
        'Returns paginated activity logs with optional filtering by table or action type.',
      operationId: 'listActivityLogs',
      tags: ['activity'],
      request: { query: activityQuerySchema },
      responses: {
        200: {
          content: { 'application/json': { schema: listActivityLogsResponseSchema } },
          description: 'Activity logs',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/activity/{activityId}
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/activity/{activityId}',
      summary: 'Get activity log details',
      description: 'Returns a single activity log entry with full change details.',
      operationId: 'getActivityLog',
      tags: ['activity'],
      request: { params: activityIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: getActivityLogResponseSchema } },
          description: 'Activity log details',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Activity not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )
}
