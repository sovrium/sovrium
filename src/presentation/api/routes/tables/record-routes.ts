/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { zValidator } from '@hono/zod-validator'
import {
  createCommentRequestSchema,
  updateCommentRequestSchema,
} from '@/domain/models/api/tables/comments'
import { listRecordsQuerySchema } from '@/domain/models/api/tables/params'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/tables/records'
import { handleGetRecordHistory } from './activity-handlers'
import { handleFormBulkDelete, handleFormBulkUpdate } from './bulk-form-handlers'
import {
  handleCreateComment,
  handleDeleteComment,
  handleGetComment,
  handleListComments,
  handleUpdateComment,
} from './comment-handlers'
import {
  handleListRecords,
  handleListTrash,
  handleCreateRecord,
  handleGetRecord,
  handleUpdateRecord,
  handleFormUpdateRecord,
  handleDeleteRecord,
  handleFormDeleteRecord,
  handleRestoreRecord,
} from './record-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

const validationErrorHook = (result: { success: boolean }, c: Context) => {
  if (!result.success) {
    return c.json(
      { success: false, message: 'Invalid request body', code: 'VALIDATION_ERROR' },
      400
    )
  }
}


export function chainRecordRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return honoApp
    .get('/api/tables/:tableId/records', zValidator('query', listRecordsQuerySchema), (c) =>
      handleListRecords(c, app)
    )
    .get('/api/tables/:tableId/trash', (c) => handleListTrash(c, app))
    .post('/api/tables/:tableId/records/bulk-delete', (c) => handleFormBulkDelete(c, app))
    .post('/api/tables/:tableId/records/bulk-update', (c) => handleFormBulkUpdate(c, app))
    .post('/api/tables/:tableId/records', zValidator('json', createRecordRequestSchema), (c) =>
      handleCreateRecord(c, app)
    )
    .get('/api/tables/:tableId/records/:recordId', (c) => handleGetRecord(c, app))
    .patch(
      '/api/tables/:tableId/records/:recordId',
      zValidator('json', updateRecordRequestSchema),
      (c) => handleUpdateRecord(c, app)
    )
    .post('/api/tables/:tableId/records/:recordId/update', (c) => handleFormUpdateRecord(c, app))
    .delete('/api/tables/:tableId/records/:recordId', (c) => handleDeleteRecord(c, app))
    .post('/api/tables/:tableId/records/:recordId/delete', (c) => handleFormDeleteRecord(c, app))
    .post('/api/tables/:tableId/records/:recordId/restore', (c) => handleRestoreRecord(c, app))
    .get('/api/tables/:tableId/records/:recordId/history', (c) => handleGetRecordHistory(c, app))
    .get('/api/tables/:tableId/records/:recordId/comments', (c) => handleListComments(c, app))
    .post(
      '/api/tables/:tableId/records/:recordId/comments',
      zValidator('json', createCommentRequestSchema, validationErrorHook),
      (c) => handleCreateComment(c, app)
    )
    .get('/api/tables/:tableId/records/:recordId/comments/:commentId', (c) =>
      handleGetComment(c, app)
    )
    .patch(
      '/api/tables/:tableId/records/:recordId/comments/:commentId',
      zValidator('json', updateCommentRequestSchema, validationErrorHook),
      (c) => handleUpdateComment(c, app)
    )
    .delete('/api/tables/:tableId/records/:recordId/comments/:commentId', (c) =>
      handleDeleteComment(c, app)
    )
}

