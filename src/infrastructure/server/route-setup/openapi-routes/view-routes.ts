/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { viewOnlyParamSchema } from '@/domain/models/api/tables/params'
import {
  getViewRecordsResponseSchema,
  getViewResponseSchema,
  listViewsResponseSchema,
} from '@/domain/models/api/tables/tables'
import { type ResourceGroupSpec, type RouteSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/views',
    summary: 'List views',
    description: 'Returns all views defined for a table.',
    operationIdBase: 'listViews',
    responses: {
      200: jsonResponse(listViewsResponseSchema, 'List of views'),
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
    request: { params: viewOnlyParamSchema },
    responses: {
      200: jsonResponse(getViewResponseSchema, 'View details'),
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
    request: { params: viewOnlyParamSchema },
    responses: {
      200: jsonResponse(getViewRecordsResponseSchema, 'Filtered records'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('View not found'),
    },
  },
]

export const viewGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Table',
  genericTag: 'views',
  genericTagDescription: 'View management and filtered record access',
  collection: (app) => app.tables ?? [],
  resourcePlaceholder: '{tableSlug}',
  genericPlaceholder: '{tableId}',
  genericParamName: 'tableId',
  routes,
}
