/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/error'
import { tableIdParamSchema } from '@/domain/models/api/params'
import {
  getTablePermissionsResponseSchema,
  getTableResponseSchema,
  listTablesResponseSchema,
} from '@/domain/models/api/tables'

/**
 * Register table management routes for OpenAPI schema generation
 */
export function registerTableRoutes(app: OpenAPIHono): void {
  // GET /api/tables
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables',
      summary: 'List all tables',
      description: 'Returns a list of all tables with summary information.',
      operationId: 'listTables',
      tags: ['tables'],
      responses: {
        200: {
          content: { 'application/json': { schema: listTablesResponseSchema } },
          description: 'List of tables',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/tables/{tableId}
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}',
      summary: 'Get table details',
      description: 'Returns full table definition including fields, views, and permissions.',
      operationId: 'getTable',
      tags: ['tables'],
      request: { params: tableIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: getTableResponseSchema } },
          description: 'Table details',
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

  // GET /api/tables/{tableId}/permissions
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/permissions',
      summary: 'Get table permissions',
      description:
        "Returns the current user's permissions for the table, including field-level access.",
      operationId: 'getTablePermissions',
      tags: ['tables'],
      request: { params: tableIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: getTablePermissionsResponseSchema } },
          description: 'Table permissions',
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
}
