/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  createCommentResponseSchema,
  getCommentResponseSchema,
  getRecordHistoryResponseSchema,
  listCommentsResponseSchema,
  updateCommentResponseSchema,
} from '@/domain/models/api/comments'
import { errorResponseSchema } from '@/domain/models/api/error'
import {
  commentBodySchema,
  commentIdParamSchema,
  listRecordsQuerySchema,
  recordIdParamSchema,
  tableIdParamSchema,
} from '@/domain/models/api/params'
import { createRecordRequestSchema, updateRecordRequestSchema } from '@/domain/models/api/request'
import {
  createRecordResponseSchema,
  deleteRecordResponseSchema,
  getRecordResponseSchema,
  listRecordsResponseSchema,
  restoreRecordResponseSchema,
  updateRecordResponseSchema,
} from '@/domain/models/api/tables'

/**
 * Register record CRUD routes for OpenAPI schema generation
 */
export function registerRecordRoutes(app: OpenAPIHono): void {
  registerCrudRoutes(app)
  registerCommentRoutes(app)
}

function registerCrudRoutes(app: OpenAPIHono): void {
  // GET /api/tables/{tableId}/records
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/records',
      summary: 'List records',
      description: 'Returns paginated records for a table with optional sorting and filtering.',
      operationId: 'listRecords',
      tags: ['records'],
      request: { params: tableIdParamSchema, query: listRecordsQuerySchema },
      responses: {
        200: {
          content: { 'application/json': { schema: listRecordsResponseSchema } },
          description: 'List of records',
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

  // POST /api/tables/{tableId}/records
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/tables/{tableId}/records',
      summary: 'Create a record',
      description: 'Creates a new record in the table with the given field values.',
      operationId: 'createRecord',
      tags: ['records'],
      request: {
        params: tableIdParamSchema,
        body: { content: { 'application/json': { schema: createRecordRequestSchema } } },
      },
      responses: {
        201: {
          content: { 'application/json': { schema: createRecordResponseSchema } },
          description: 'Record created',
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

  // GET /api/tables/{tableId}/records/{recordId}
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/records/{recordId}',
      summary: 'Get a record',
      description: 'Returns a single record by ID with all field values.',
      operationId: 'getRecord',
      tags: ['records'],
      request: { params: recordIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: getRecordResponseSchema } },
          description: 'Record details',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Record not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // PATCH /api/tables/{tableId}/records/{recordId}
  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/tables/{tableId}/records/{recordId}',
      summary: 'Update a record',
      description: 'Updates field values of an existing record.',
      operationId: 'updateRecord',
      tags: ['records'],
      request: {
        params: recordIdParamSchema,
        body: { content: { 'application/json': { schema: updateRecordRequestSchema } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: updateRecordResponseSchema } },
          description: 'Record updated',
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
          description: 'Record not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // DELETE /api/tables/{tableId}/records/{recordId}
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/tables/{tableId}/records/{recordId}',
      summary: 'Delete a record',
      description: 'Soft-deletes a record. Use the restore endpoint to undo.',
      operationId: 'deleteRecord',
      tags: ['records'],
      request: { params: recordIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: deleteRecordResponseSchema } },
          description: 'Record deleted',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Record not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/tables/{tableId}/records/{recordId}/restore
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/tables/{tableId}/records/{recordId}/restore',
      summary: 'Restore a deleted record',
      description: 'Restores a soft-deleted record back to active state.',
      operationId: 'restoreRecord',
      tags: ['records'],
      request: { params: recordIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: restoreRecordResponseSchema } },
          description: 'Record restored',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Record not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/tables/{tableId}/trash
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/trash',
      summary: 'List deleted records',
      description: 'Returns paginated list of soft-deleted records in the trash.',
      operationId: 'listTrashRecords',
      tags: ['records'],
      request: { params: tableIdParamSchema, query: listRecordsQuerySchema },
      responses: {
        200: {
          content: { 'application/json': { schema: listRecordsResponseSchema } },
          description: 'List of deleted records',
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

  // GET /api/tables/{tableId}/records/{recordId}/history
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/records/{recordId}/history',
      summary: 'Get record history',
      description: 'Returns the audit trail of changes for a specific record.',
      operationId: 'getRecordHistory',
      tags: ['records'],
      request: { params: recordIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: getRecordHistoryResponseSchema } },
          description: 'Record history',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Record not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )
}

function registerCommentRoutes(app: OpenAPIHono): void {
  // GET /api/tables/{tableId}/records/{recordId}/comments
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/records/{recordId}/comments',
      summary: 'List comments on a record',
      description: 'Returns paginated comments for a specific record.',
      operationId: 'listComments',
      tags: ['records'],
      request: { params: recordIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: listCommentsResponseSchema } },
          description: 'List of comments',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Record not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/tables/{tableId}/records/{recordId}/comments
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/tables/{tableId}/records/{recordId}/comments',
      summary: 'Create a comment',
      description: 'Adds a comment to a record.',
      operationId: 'createComment',
      tags: ['records'],
      request: {
        params: recordIdParamSchema,
        body: { content: { 'application/json': { schema: commentBodySchema } } },
      },
      responses: {
        201: {
          content: { 'application/json': { schema: createCommentResponseSchema } },
          description: 'Comment created',
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
          description: 'Record not found',
        },
      },
    }),
    (c) => c.json({} as never, 201)
  )

  // GET /api/tables/{tableId}/records/{recordId}/comments/{commentId}
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/tables/{tableId}/records/{recordId}/comments/{commentId}',
      summary: 'Get a comment',
      description: 'Returns a single comment by ID.',
      operationId: 'getComment',
      tags: ['records'],
      request: { params: commentIdParamSchema },
      responses: {
        200: {
          content: { 'application/json': { schema: getCommentResponseSchema } },
          description: 'Comment details',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Comment not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // PATCH /api/tables/{tableId}/records/{recordId}/comments/{commentId}
  app.openapi(
    createRoute({
      method: 'patch',
      path: '/api/tables/{tableId}/records/{recordId}/comments/{commentId}',
      summary: 'Update a comment',
      description: 'Updates the content of a comment. Only the author can update.',
      operationId: 'updateComment',
      tags: ['records'],
      request: {
        params: commentIdParamSchema,
        body: { content: { 'application/json': { schema: commentBodySchema } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: updateCommentResponseSchema } },
          description: 'Comment updated',
        },
        400: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Validation error',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        403: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Forbidden',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Comment not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // DELETE /api/tables/{tableId}/records/{recordId}/comments/{commentId}
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api/tables/{tableId}/records/{recordId}/comments/{commentId}',
      summary: 'Delete a comment',
      description: 'Soft-deletes a comment. Only the author or admin can delete.',
      operationId: 'deleteComment',
      tags: ['records'],
      request: { params: commentIdParamSchema },
      responses: {
        204: {
          description: 'Comment deleted (no content)',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Unauthorized',
        },
        403: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Forbidden',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Comment not found',
        },
      },
    }),
    // eslint-disable-next-line unicorn/no-null -- Hono c.body() requires null for 204
    (c) => c.body(null, 204)
  )
}
