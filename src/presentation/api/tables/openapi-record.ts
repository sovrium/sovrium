/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  createCommentResponseSchema,
  getCommentResponseSchema,
  getRecordHistoryResponseSchema,
  listCommentsResponseSchema,
  updateCommentResponseSchema,
} from '@/domain/models/api/tables/comments'
import {
  commentBodySchema,
  commentOnlyParamSchema,
  listRecordsQuerySchema,
  recordOnlyParamSchema,
} from '@/domain/models/api/tables/params'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/tables/records'
import {
  createRecordResponseSchema,
  deleteRecordResponseSchema,
  getRecordResponseSchema,
  listRecordsResponseSchema,
  restoreRecordResponseSchema,
  updateRecordResponseSchema,
} from '@/domain/models/api/tables/tables'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
} from '@/presentation/api/openapi/route-fragments'
import { type ResourceGroupSpec, type RouteSpec } from '../openapi/route-spec'

/**
 * Record CRUD, trash, history, and comment routes.
 *
 * Resource-scoped to `app.tables`: each configured table expands into a
 * concrete copy of every route below, tagged `Table: <name>`. The table id is
 * baked into the concrete path, so `request.params` here omits it — see the
 * `*OnlyParamSchema` schemas in `domain/models/api/tables/params.ts`.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/records',
    summary: 'List records',
    description: 'Returns paginated records for a table with optional sorting and filtering.',
    operationIdBase: 'listRecords',
    parameters: effectParameters(listRecordsQuerySchema, 'query'),
    responses: {
      200: effectJsonResponse(listRecordsResponseSchema, 'List of records'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/tables/{tableSlug}/records',
    summary: 'Create a record',
    description: 'Creates a new record in the table with the given field values.',
    operationIdBase: 'createRecord',

    request: { body: effectJsonBody(createRecordRequestSchema) },
    responses: {
      201: effectJsonResponse(createRecordResponseSchema, 'Record created'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}',
    summary: 'Get a record',
    description: 'Returns a single record by ID with all field values.',
    operationIdBase: 'getRecord',
    parameters: effectParameters(recordOnlyParamSchema, 'path'),
    responses: {
      200: effectJsonResponse(getRecordResponseSchema, 'Record details'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Record not found'),
    },
  },
  {
    method: 'patch',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}',
    summary: 'Update a record',
    description: 'Updates field values of an existing record.',
    operationIdBase: 'updateRecord',
    parameters: effectParameters(recordOnlyParamSchema, 'path'),

    request: { body: effectJsonBody(updateRecordRequestSchema) },
    responses: {
      200: effectJsonResponse(updateRecordResponseSchema, 'Record updated'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Record not found'),
    },
  },
  {
    method: 'delete',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}',
    summary: 'Delete a record',
    description: 'Soft-deletes a record. Use the restore endpoint to undo.',
    operationIdBase: 'deleteRecord',
    parameters: effectParameters(recordOnlyParamSchema, 'path'),
    responses: {
      200: effectJsonResponse(deleteRecordResponseSchema, 'Record deleted'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Record not found'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}/restore',
    summary: 'Restore a deleted record',
    description: 'Restores a soft-deleted record back to active state.',
    operationIdBase: 'restoreRecord',
    parameters: effectParameters(recordOnlyParamSchema, 'path'),
    responses: {
      200: effectJsonResponse(restoreRecordResponseSchema, 'Record restored'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Record not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/trash',
    summary: 'List deleted records',
    description: 'Returns paginated list of soft-deleted records in the trash.',
    operationIdBase: 'listTrashRecords',
    parameters: effectParameters(listRecordsQuerySchema, 'query'),
    responses: {
      200: effectJsonResponse(listRecordsResponseSchema, 'List of deleted records'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Table not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}/history',
    summary: 'Get record history',
    description: 'Returns the audit trail of changes for a specific record.',
    operationIdBase: 'getRecordHistory',
    parameters: effectParameters(recordOnlyParamSchema, 'path'),
    responses: {
      200: effectJsonResponse(getRecordHistoryResponseSchema, 'Record history'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Record not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}/comments',
    summary: 'List comments on a record',
    description: 'Returns paginated comments for a specific record.',
    operationIdBase: 'listComments',
    parameters: effectParameters(recordOnlyParamSchema, 'path'),
    responses: {
      200: effectJsonResponse(listCommentsResponseSchema, 'List of comments'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Record not found'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}/comments',
    summary: 'Create a comment',
    description: 'Adds a comment to a record.',
    operationIdBase: 'createComment',
    parameters: effectParameters(recordOnlyParamSchema, 'path'),
    request: { body: effectJsonBody(commentBodySchema) },
    responses: {
      201: effectJsonResponse(createCommentResponseSchema, 'Comment created'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Record not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}/comments/{commentId}',
    summary: 'Get a comment',
    description: 'Returns a single comment by ID.',
    operationIdBase: 'getComment',
    parameters: effectParameters(commentOnlyParamSchema, 'path'),
    responses: {
      200: effectJsonResponse(getCommentResponseSchema, 'Comment details'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Comment not found'),
    },
  },
  {
    method: 'patch',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}/comments/{commentId}',
    summary: 'Update a comment',
    description: 'Updates the content of a comment. Only the author can update.',
    operationIdBase: 'updateComment',
    parameters: effectParameters(commentOnlyParamSchema, 'path'),
    request: { body: effectJsonBody(commentBodySchema) },
    responses: {
      200: effectJsonResponse(updateCommentResponseSchema, 'Comment updated'),
      400: errorResponse('Validation error'),
      401: errorResponse('Unauthorized'),
      403: errorResponse('Forbidden'),
      404: errorResponse('Comment not found'),
    },
  },
  {
    method: 'delete',
    pathTemplate: '/api/tables/{tableSlug}/records/{recordId}/comments/{commentId}',
    summary: 'Delete a comment',
    description: 'Soft-deletes a comment. Only the author or admin can delete.',
    operationIdBase: 'deleteComment',
    parameters: effectParameters(commentOnlyParamSchema, 'path'),
    responses: {
      204: { description: 'Comment deleted (no content)' },
      401: errorResponse('Unauthorized'),
      403: errorResponse('Forbidden'),
      404: errorResponse('Comment not found'),
    },
  },
]

/**
 * Record route group — resource-scoped to the configured tables.
 */
export const recordsGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Table',
  genericTag: 'Records',
  genericTagDescription: 'Record CRUD, comments, and history endpoints',
  collection: (app) => app.tables ?? [],
  resourcePlaceholder: '{tableSlug}',
  genericPlaceholder: '{tableId}',
  genericParamName: 'tableId',
  routes,
}
