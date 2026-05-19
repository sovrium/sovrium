/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { errorResponseSchema } from '@/domain/models/api/_shared/error'
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
import { type ResourceGroupSpec, type RouteSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/tables/{tableSlug}/records',
    summary: 'List records',
    description: 'Returns paginated records for a table with optional sorting and filtering.',
    operationIdBase: 'listRecords',
    request: { query: listRecordsQuerySchema },
    responses: {
      200: jsonResponse(listRecordsResponseSchema, 'List of records'),
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
    request: {
      body: { content: { 'application/json': { schema: createRecordRequestSchema } } },
    },
    responses: {
      201: jsonResponse(createRecordResponseSchema, 'Record created'),
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
    request: { params: recordOnlyParamSchema },
    responses: {
      200: jsonResponse(getRecordResponseSchema, 'Record details'),
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
    request: {
      params: recordOnlyParamSchema,
      body: { content: { 'application/json': { schema: updateRecordRequestSchema } } },
    },
    responses: {
      200: jsonResponse(updateRecordResponseSchema, 'Record updated'),
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
    request: { params: recordOnlyParamSchema },
    responses: {
      200: jsonResponse(deleteRecordResponseSchema, 'Record deleted'),
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
    request: { params: recordOnlyParamSchema },
    responses: {
      200: jsonResponse(restoreRecordResponseSchema, 'Record restored'),
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
    request: { query: listRecordsQuerySchema },
    responses: {
      200: jsonResponse(listRecordsResponseSchema, 'List of deleted records'),
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
    request: { params: recordOnlyParamSchema },
    responses: {
      200: jsonResponse(getRecordHistoryResponseSchema, 'Record history'),
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
    request: { params: recordOnlyParamSchema },
    responses: {
      200: jsonResponse(listCommentsResponseSchema, 'List of comments'),
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
    request: {
      params: recordOnlyParamSchema,
      body: { content: { 'application/json': { schema: commentBodySchema } } },
    },
    responses: {
      201: jsonResponse(createCommentResponseSchema, 'Comment created'),
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
    request: { params: commentOnlyParamSchema },
    responses: {
      200: jsonResponse(getCommentResponseSchema, 'Comment details'),
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
    request: {
      params: commentOnlyParamSchema,
      body: { content: { 'application/json': { schema: commentBodySchema } } },
    },
    responses: {
      200: jsonResponse(updateCommentResponseSchema, 'Comment updated'),
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
    request: { params: commentOnlyParamSchema },
    responses: {
      204: { description: 'Comment deleted (no content)' },
      401: errorResponse('Unauthorized'),
      403: errorResponse('Forbidden'),
      404: errorResponse('Comment not found'),
    },
  },
]

export const recordsGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Table',
  genericTag: 'records',
  genericTagDescription: 'Record CRUD, comments, and history endpoints',
  collection: (app) => app.tables ?? [],
  resourcePlaceholder: '{tableSlug}',
  genericPlaceholder: '{tableId}',
  genericParamName: 'tableId',
  routes,
}
