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
  batchCreateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  batchRestoreRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from '@/domain/models/api/request'
import {
  batchCreateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  batchRestoreRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  upsertRecordsResponseSchema,
} from '@/domain/models/api/tables'

/**
 * Register batch operation routes for OpenAPI schema generation
 */
export function registerBatchRoutes(app: OpenAPIHono): void {
  // POST /api/tables/{tableId}/records/batch (create)
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/tables/{tableId}/records/batch',
      summary: 'Batch create records',
      description: 'Creates multiple records in a single request (up to 1000).',
      operationId: 'batchCreateRecords',
      tags: ['records'],
      request: {
        params: tableIdParamSchema,
        body: {
          content: { 'application/json': { schema: batchCreateRecordsRequestSchema } },
        },
      },
      responses: {
        201: {
          content: { 'application/json': { schema: batchCreateRecordsResponseSchema } },
          description: 'Records created',
        },
        400: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Validation error',
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
    (c) => c.json({} as never, 201)
  )

  // PATCH /api/tables/{tableId}/records/batch (update)
  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/tables/{tableId}/records/batch',
      summary: 'Batch update records',
      description: 'Updates multiple records in a single request (up to 100).',
      operationId: 'batchUpdateRecords',
      tags: ['records'],
      request: {
        params: tableIdParamSchema,
        body: {
          content: { 'application/json': { schema: batchUpdateRecordsRequestSchema } },
        },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: batchUpdateRecordsResponseSchema } },
          description: 'Records updated',
        },
        400: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Validation error',
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

  // DELETE /api/tables/{tableId}/records/batch
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/tables/{tableId}/records/batch',
      summary: 'Batch delete records',
      description: 'Soft-deletes multiple records in a single request (up to 100).',
      operationId: 'batchDeleteRecords',
      tags: ['records'],
      request: {
        params: tableIdParamSchema,
        body: {
          content: { 'application/json': { schema: batchDeleteRecordsRequestSchema } },
        },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: batchDeleteRecordsResponseSchema } },
          description: 'Records deleted',
        },
        400: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Validation error',
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

  // POST /api/tables/{tableId}/records/batch/restore
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/tables/{tableId}/records/batch/restore',
      summary: 'Batch restore deleted records',
      description: 'Restores multiple soft-deleted records in a single request (up to 100).',
      operationId: 'batchRestoreRecords',
      tags: ['records'],
      request: {
        params: tableIdParamSchema,
        body: {
          content: { 'application/json': { schema: batchRestoreRecordsRequestSchema } },
        },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: batchRestoreRecordsResponseSchema } },
          description: 'Records restored',
        },
        400: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Validation error',
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

  // POST /api/tables/{tableId}/records/upsert
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/tables/{tableId}/records/upsert',
      summary: 'Upsert records',
      description:
        'Creates or updates records based on merge fields. Existing records matching the merge fields are updated; new records are created.',
      operationId: 'upsertRecords',
      tags: ['records'],
      request: {
        params: tableIdParamSchema,
        body: {
          content: { 'application/json': { schema: upsertRecordsRequestSchema } },
        },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: upsertRecordsResponseSchema } },
          description: 'Records upserted',
        },
        400: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Validation error',
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
