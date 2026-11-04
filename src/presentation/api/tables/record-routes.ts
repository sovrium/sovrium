/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { aggregateRecordsQuerySchema } from '@/domain/models/api/tables/aggregate'
import { updateCommentRequestSchema } from '@/domain/models/api/tables/comments'
import { getRecordQuerySchema, listRecordsQuerySchema } from '@/domain/models/api/tables/params'
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
import { handleLinkPreviewPicture, handleListLinkPreviews } from './link-preview-handlers'
import { handleMarkRecordRead } from './read-state-handlers'
import { refuseUnreadableTable } from './readable-table-gate'
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
import { servesRecordLanguage } from './record-read-language'
import { handleSignRecordField, signRequestBodyLimit } from './record-signature-handler'
import { handleSubscribe } from './subscribe-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

// A single fluent Hono chain — splitting it breaks Hono's RPC client type
// inference (the chain's structure is load-bearing for the generated
// `ClientRequest` types), so the max-lines cap is waived here.
// eslint-disable-next-line max-lines-per-function -- fluent RPC chain, see above
export function chainRecordRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return (
    honoApp
      .get(
        '/api/tables/:tableId/records',
        // A table she may not read answers as missing before its query is judged.
        refuseUnreadableTable(app),
        effectValidator('query', listRecordsQuerySchema),
        conditionalRead(),
        servesRecordLanguage(app),
        (c) => handleListRecords(c, app)
      )
      .get(
        '/api/tables/:tableId/aggregate',
        refuseUnreadableTable(app),
        effectValidator('query', aggregateRecordsQuerySchema),
        conditionalRead(),
        (c) => handleAggregateRecords(c, app)
      )
      .get('/api/tables/:tableId/trash', refuseUnreadableTable(app), (c) => handleListTrash(c, app))
      // The four HTML-form verbs: the only routes here that take a form post
      // (every other body must be JSON — `refuseNonJsonBody`).
      .post(
        '/api/tables/:tableId/records/bulk-delete',
        acceptsFormBody((c: Context) => handleFormBulkDelete(c, app))
      )
      .post(
        '/api/tables/:tableId/records/bulk-update',
        acceptsFormBody((c: Context) => handleFormBulkUpdate(c, app))
      )
      .post(
        '/api/tables/:tableId/records',
        effectValidator('json', createRecordRequestSchema),
        (c) => handleCreateRecord(c, app)
      )
      .get('/api/tables/:tableId/subscribe/sse', (c) => handleSubscribe(c, app))
      .get('/api/tables/:tableId/subscribe', (c) => handleSubscribe(c, app))
      .get(
        '/api/tables/:tableId/records/:recordId',
        effectValidator('query', getRecordQuerySchema),
        conditionalRead(),
        servesRecordLanguage(app),
        (c) => handleGetRecord(c, app)
      )
      .patch(
        '/api/tables/:tableId/records/:recordId',
        effectValidator('json', updateRecordRequestSchema),
        (c) => handleUpdateRecord(c, app)
      )
      .post(
        '/api/tables/:tableId/records/:recordId/update',
        acceptsFormBody((c: Context) => handleFormUpdateRecord(c, app))
      )
      .delete('/api/tables/:tableId/records/:recordId', (c) => handleDeleteRecord(c, app))
      .post(
        '/api/tables/:tableId/records/:recordId/delete',
        acceptsFormBody((c: Context) => handleFormDeleteRecord(c, app))
      )
      .post('/api/tables/:tableId/records/:recordId/read', (c) => handleMarkRecordRead(c, app))
      .post('/api/tables/:tableId/records/:recordId/restore', (c) => handleRestoreRecord(c, app))
      .post('/api/tables/:tableId/records/:recordId/buttons/:fieldName', (c) =>
        handleInvokeRecordButton(c, app)
      )
      // A signature is posted as multipart: the drawing's PNG bytes beside the consent.
      .post(
        '/api/tables/:tableId/records/:recordId/signatures/:field',
        signRequestBodyLimit,
        acceptsFormBody((c: Context) => handleSignRecordField(c, app))
      )
      // The link previews of a stored message: reads of the server's cache,
      // through the record's own read gate; neither takes an address.
      .get('/api/tables/:tableId/records/:recordId/link-previews', (c) =>
        handleListLinkPreviews(c, app)
      )
      .get('/api/tables/:tableId/records/:recordId/link-previews/:previewId', (c) =>
        handleLinkPreviewPicture(c, app)
      )
      .get('/api/tables/:tableId/records/:recordId/history', (c) => handleGetRecordHistory(c, app))
      .get('/api/tables/:tableId/records/:recordId/comments', (c) => handleListComments(c, app))
      // No route validator: the thread's sign-in, record and spam-trap gates
      // answer before the body is judged (`checkCreateCommentGate`), so a
      // malformed post cannot tell a prober which gate it reached.
      .post('/api/tables/:tableId/records/:recordId/comments', (c) => handleCreateComment(c, app))
      .post('/api/tables/:tableId/records/:recordId/comments/read', (c) =>
        handleMarkCommentsRead(c, app)
      )
      // Registered BEFORE `/comments/:commentId`, which would otherwise read
      // `mentionable` as a comment id.
      .get('/api/tables/:tableId/records/:recordId/comments/mentionable', (c) =>
        handleListMentionable(c, app)
      )
      .get('/api/tables/:tableId/records/:recordId/comments/:commentId', (c) =>
        handleGetComment(c, app)
      )
      // The table's read gate before the body is judged: a table its caller
      // may not read answers a malformed edit as it answers an unknown table.
      .patch(
        '/api/tables/:tableId/records/:recordId/comments/:commentId',
        refuseUnreadableTable(app),
        effectValidator('json', updateCommentRequestSchema),
        (c) => handleUpdateComment(c, app)
      )
      .delete('/api/tables/:tableId/records/:recordId/comments/:commentId', (c) =>
        handleDeleteComment(c, app)
      )
  )
}
