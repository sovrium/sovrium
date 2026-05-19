/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  getTablePermissionsResponseSchema,
  getTableResponseSchema,
  listTablesResponseSchema,
} from '@/domain/models/api/tables/tables'
import {
  type ResourceGroupSpec,
  type RouteSpec,
  type StaticGroupSpec,
  jsonResponse,
} from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

export const tableCollectionGroup: StaticGroupSpec = {
  tag: 'tables',
  tagDescription: 'Table management endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/tables',
      summary: 'List all tables',
      description: 'Returns a list of all tables with summary information.',
      operationIdBase: 'listTables',
      responses: {
        200: jsonResponse(listTablesResponseSchema, 'List of tables'),
        401: errorResponse('Unauthorized'),
      },
    },
  ],
}

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}',
    summary: 'Get table details',
    description: 'Returns full table definition including fields, views, and permissions.',
    operationIdBase: 'getTable',
    responses: {
      200: jsonResponse(getTableResponseSchema, 'Table details'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/permissions',
    summary: 'Get table permissions',
    description:
      "Returns the current user's permissions for the table, including field-level access.",
    operationIdBase: 'getTablePermissions',
    responses: {
      200: jsonResponse(getTablePermissionsResponseSchema, 'Table permissions'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
]

export const tableGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Table',
  genericTag: 'tables',
  genericTagDescription: 'Table management endpoints',
  collection: (app) => app.tables ?? [],
  resourcePlaceholder: '{tableSlug}',
  genericPlaceholder: '{tableId}',
  genericParamName: 'tableId',
  routes,
}
