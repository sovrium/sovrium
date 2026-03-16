/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/error'
import { tableIdParamSchema, viewIdParamSchema } from '@/domain/models/api/params'
import {
  getViewRecordsResponseSchema,
  getViewResponseSchema,
  listViewsResponseSchema,
} from '@/domain/models/api/tables'

/**
 * Register view routes for OpenAPI schema generation
 */
export function registerViewRoutes(app: OpenAPIHono): void {
  // GET /api/tables/{tableId}/views
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/views',
      summary: 'List views',
      description: 'Returns all views defined for a table.',
      operationId: 'listViews',
      tags: ['views'],
      request: { params: tableIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: listViewsResponseSchema } },
          description: 'List of views',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Table not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/tables/{tableId}/views/{viewId}
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/views/{viewId}',
      summary: 'Get view details',
      description: 'Returns view configuration including filters, sorts, and visible fields.',
      operationId: 'getView',
      tags: ['views'],
      request: { params: viewIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: getViewResponseSchema } },
          description: 'View details',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'View not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/tables/{tableId}/views/{viewId}/records
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/views/{viewId}/records',
      summary: 'Get records through a view',
      description: 'Returns records filtered and sorted according to the view configuration.',
      operationId: 'getViewRecords',
      tags: ['views'],
      request: { params: viewIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: getViewRecordsResponseSchema } },
          description: 'Filtered records',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'View not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )
}
