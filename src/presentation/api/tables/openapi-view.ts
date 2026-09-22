/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { viewOnlyParamSchema } from '@/domain/models/api/tables/params'
import {
  getViewRecordsResponseSchema,
  getViewResponseSchema,
  listViewsResponseSchema,
} from '@/domain/models/api/tables/tables'
import { effectJsonResponse, effectParameters } from '@/presentation/api/openapi/route-fragments'
import { type ResourceGroupSpec, type RouteSpec } from '../openapi/route-spec'

/**
 * View routes — resource-scoped to `app.tables`. Each configured table expands
 * into a concrete copy of every route below, tagged `Table: <name>`. The table
 * id is baked into the concrete path, so `request.params` omits it.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/views',
    summary: 'List views',
    description: 'Returns all views defined for a table.',
    operationIdBase: 'listViews',
    responses: {
      200: effectJsonResponse(listViewsResponseSchema, 'List of views'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/views/{viewId}',
    summary: 'Get view details',
    description: 'Returns view configuration including filters, sorts, and visible fields.',
    operationIdBase: 'getView',

    parameters: effectParameters(viewOnlyParamSchema, 'path'),
    responses: {
      200: effectJsonResponse(getViewResponseSchema, 'View details'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('View not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/views/{viewId}/records',
    summary: 'Get records through a view',
    description: 'Returns records filtered and sorted according to the view configuration.',
    operationIdBase: 'getViewRecords',

    parameters: effectParameters(viewOnlyParamSchema, 'path'),
    responses: {
      200: effectJsonResponse(getViewRecordsResponseSchema, 'Filtered records'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('View not found'),
    },
  },
]

/** View route group — resource-scoped to the configured tables. */
export const viewGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Table',
  genericTag: 'Views',
  genericTagDescription: 'View management and filtered record access',
  collection: (app) => app.tables ?? [],
  resourcePlaceholder: '{tableSlug}',
  genericPlaceholder: '{tableId}',
  genericParamName: 'tableId',
  routes,
}
