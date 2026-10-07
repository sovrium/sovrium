/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { aggregateRecordsQuerySchema } from '@/domain/models/api/tables/aggregate'
import { updateCommentRequestSchema } from '@/domain/models/api/tables/comments'
import { listRecordsQuerySchema } from '@/domain/models/api/tables/params'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/tables/records'
import { acceptsFormBody } from '@/presentation/api/middleware/json-body'
import { conditionalRead } from '@/presentation/api/runtime/conditional-read'
import { effectValidator } from '@/presentation/api/runtime/effect-validator'
import { handleGetRecordHistory } from './activity-handlers'
import { handleAggregateRecords } from './aggregate-handlers'
import { handleFormBulkDelete, handleFormBulkUpdate } from './bulk-form-handlers'
import {
  handleCreateComment,
  handleDeleteComment,
  handleGetComment,
  handleListComments,
  handleMarkCommentsRead,
  handleUpdateComment,
} from './comment-handlers'
import { handleListMentionable } from './comment-mention-handler'
import { handleInvokeRecordButton } from './record-button-handlers'
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
import { handleSubscribe } from './subscribe-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

// A single fluent Hono chain — splitting it breaks Hono's RPC client type
// inference (the chain's structure is load-bearing for the generated
// `ClientRequest` types), so the max-lines cap is waived here.
// eslint-disable-next-line max-lines-per-function -- fluent RPC chain, see above
export function chainRecordRoutesMethods<T extends Hono>(honoApp: T, resolveApp: () => App) {
  return (
    honoApp
      .get(
        '/api/tables/:tableId/records',
        effectValidator('query', listRecordsQuerySchema),
        conditionalRead(),
        (c) => handleListRecords(c, resolveApp())
      )
      .get(
        '/api/tables/:tableId/aggregate',
        effectValidator('query', aggregateRecordsQuerySchema),
        conditionalRead(),
        (c) => handleAggregateRecords(c, resolveApp())
      )
      .get('/api/tables/:tableId/trash', (c) => handleListTrash(c, resolveApp()))
      // The four HTML-form verbs: the only routes here that take a form post
      // (every other body must be JSON — `refuseNonJsonBody`).
      .post(
        '/api/tables/:tableId/records/bulk-delete',
        acceptsFormBody((c: Context) => handleFormBulkDelete(c, resolveApp()))
      )
      .post(
        '/api/tables/:tableId/records/bulk-update',
        acceptsFormBody((c: Context) => handleFormBulkUpdate(c, resolveApp()))
      )
      .post(
        '/api/tables/:tableId/records',
        effectValidator('json', createRecordRequestSchema),
        (c) => handleCreateRecord(c, resolveApp())
      )
      .get('/api/tables/:tableId/subscribe/sse', (c) => handleSubscribe(c, resolveApp()))
      .get('/api/tables/:tableId/subscribe', (c) => handleSubscribe(c, resolveApp()))
      .get('/api/tables/:tableId/records/:recordId', conditionalRead(), (c) =>
        handleGetRecord(c, resolveApp())
      )
      .patch(
        '/api/tables/:tableId/records/:recordId',
        effectValidator('json', updateRecordRequestSchema),
        (c) => handleUpdateRecord(c, resolveApp())
      )
      .post(
        '/api/tables/:tableId/records/:recordId/update',
        acceptsFormBody((c: Context) => handleFormUpdateRecord(c, resolveApp()))
      )
      .delete('/api/tables/:tableId/records/:recordId', (c) => handleDeleteRecord(c, resolveApp()))
      .post(
        '/api/tables/:tableId/records/:recordId/delete',
        acceptsFormBody((c: Context) => handleFormDeleteRecord(c, resolveApp()))
      )
      .post('/api/tables/:tableId/records/:recordId/restore', (c) =>
        handleRestoreRecord(c, resolveApp())
      )
      .post('/api/tables/:tableId/records/:recordId/buttons/:fieldName', (c) =>
        handleInvokeRecordButton(c, resolveApp())
      )
      .get('/api/tables/:tableId/records/:recordId/history', (c) =>
        handleGetRecordHistory(c, resolveApp())
      )
      .get('/api/tables/:tableId/records/:recordId/comments', (c) =>
        handleListComments(c, resolveApp())
      )
      // No route validator: the thread's sign-in, record and spam-trap gates
      // answer before the body is judged (`checkCreateCommentGate`), so a
      // malformed post cannot tell a prober which gate it reached.
      .post('/api/tables/:tableId/records/:recordId/comments', (c) =>
        handleCreateComment(c, resolveApp())
      )
      .post('/api/tables/:tableId/records/:recordId/comments/read', (c) =>
        handleMarkCommentsRead(c, resolveApp())
      )
      // Registered BEFORE `/comments/:commentId`, which would otherwise read
      // `mentionable` as a comment id.
      .get('/api/tables/:tableId/records/:recordId/comments/mentionable', (c) =>
        handleListMentionable(c, resolveApp())
      )
      .get('/api/tables/:tableId/records/:recordId/comments/:commentId', (c) =>
        handleGetComment(c, resolveApp())
      )
      .patch(
        '/api/tables/:tableId/records/:recordId/comments/:commentId',
        effectValidator('json', updateCommentRequestSchema),
        (c) => handleUpdateComment(c, resolveApp())
      )
      .delete('/api/tables/:tableId/records/:recordId/comments/:commentId', (c) =>
        handleDeleteComment(c, resolveApp())
      )
  )
}
