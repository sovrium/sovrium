/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/_shared/error'
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
import { type ResourceGroupSpec, type RouteSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'post',
    pathTemplate: '/api/tables/{tableSlug}/records/batch',
    summary: 'Batch create records',
    description: 'Creates multiple records in a single request (up to 1000).',
    operationIdBase: 'batchCreateRecords',
    request: {
      body: { content: { 'application/json': { schema: batchCreateRecordsRequestSchema } } },
    },
    responses: {
      201: jsonResponse(batchCreateRecordsResponseSchema, 'Records created'),
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
    request: {
      body: { content: { 'application/json': { schema: batchUpdateRecordsRequestSchema } } },
    },
    responses: {
      200: jsonResponse(batchUpdateRecordsResponseSchema, 'Records updated'),
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
    request: {
      body: { content: { 'application/json': { schema: batchDeleteRecordsRequestSchema } } },
    },
    responses: {
      200: jsonResponse(batchDeleteRecordsResponseSchema, 'Records deleted'),
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
    request: {
      body: { content: { 'application/json': { schema: batchRestoreRecordsRequestSchema } } },
    },
    responses: {
      200: jsonResponse(batchRestoreRecordsResponseSchema, 'Records restored'),
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
    request: {
      body: { content: { 'application/json': { schema: upsertRecordsRequestSchema } } },
    },
    responses: {
      200: jsonResponse(upsertRecordsResponseSchema, 'Records upserted'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
]

export const batchGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Table',
  genericTag: 'records',
  genericTagDescription: 'Record CRUD, comments, and history endpoints',
  collection: (app) => app.tables ?? [],
  resourcePlaceholder: '{tableSlug}',
  genericPlaceholder: '{tableId}',
  genericParamName: 'tableId',
  routes,
}
