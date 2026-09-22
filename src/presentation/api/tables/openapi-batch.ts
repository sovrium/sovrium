/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  batchCreateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  batchRestoreRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from '@/domain/models/api/tables/records'
import {
  batchCreateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  batchRestoreRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  upsertRecordsResponseSchema,
} from '@/domain/models/api/tables/tables'
import { effectJsonBody, effectJsonResponse } from '@/presentation/api/openapi/route-fragments'
import { type ResourceGroupSpec, type RouteSpec } from '../openapi/route-spec'

/**
 * Batch record-operation routes — resource-scoped to `app.tables`. Each
 * configured table expands into a concrete copy of every route below, tagged
 * `Table: <name>`. The table id is baked into the concrete path, so
 * `request.params` omits it.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'post',
    pathTemplate: '/api/tables/{tableSlug}/records/batch',
    summary: 'Batch create records',
    description: 'Creates multiple records in a single request (up to 1000).',
    operationIdBase: 'batchCreateRecords',

    request: { body: effectJsonBody(batchCreateRecordsRequestSchema) },
    responses: {
      201: effectJsonResponse(batchCreateRecordsResponseSchema, 'Records created'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'patch',
    pathTemplate: '/api/tables/{tableSlug}/records/batch',
    summary: 'Batch update records',
    description: 'Updates multiple records in a single request (up to 100).',
    operationIdBase: 'batchUpdateRecords',

    request: { body: effectJsonBody(batchUpdateRecordsRequestSchema) },
    responses: {
      200: effectJsonResponse(batchUpdateRecordsResponseSchema, 'Records updated'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'delete',
    pathTemplate: '/api/tables/{tableSlug}/records/batch',
    summary: 'Batch delete records',
    description: 'Soft-deletes multiple records in a single request (up to 100).',
    operationIdBase: 'batchDeleteRecords',

    request: { body: effectJsonBody(batchDeleteRecordsRequestSchema) },
    responses: {
      200: effectJsonResponse(batchDeleteRecordsResponseSchema, 'Records deleted'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/tables/{tableSlug}/records/batch/restore',
    summary: 'Batch restore deleted records',
    description: 'Restores multiple soft-deleted records in a single request (up to 100).',
    operationIdBase: 'batchRestoreRecords',

    request: { body: effectJsonBody(batchRestoreRecordsRequestSchema) },
    responses: {
      200: effectJsonResponse(batchRestoreRecordsResponseSchema, 'Records restored'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/tables/{tableSlug}/records/upsert',
    summary: 'Upsert records',
    description:
      'Creates or updates records based on merge fields. Existing records matching the merge fields are updated; new records are created.',
    operationIdBase: 'upsertRecords',

    request: { body: effectJsonBody(upsertRecordsRequestSchema) },
    responses: {
      200: effectJsonResponse(upsertRecordsResponseSchema, 'Records upserted'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
]

/** Batch record-operation route group — resource-scoped to the configured tables. */
export const batchGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Table',
  genericTag: 'Records',
  genericTagDescription: 'Record CRUD, comments, and history endpoints',
  collection: (app) => app.tables ?? [],
  resourcePlaceholder: '{tableSlug}',
  genericPlaceholder: '{tableId}',
  genericParamName: 'tableId',
  routes,
}
