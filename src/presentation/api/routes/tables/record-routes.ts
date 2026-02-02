/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  handleListRecords,
  handleListTrash,
  handleCreateRecord,
  handleGetRecord,
  handleUpdateRecord,
  handleDeleteRecord,
  handleRestoreRecord,
} from './record-handlers'
import { handleCreateComment } from './comment-handlers'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/* eslint-disable drizzle/enforce-delete-with-where -- These are Hono route methods, not Drizzle queries */

export function chainRecordRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return honoApp
    .get('/api/tables/:tableId/records', (c) => handleListRecords(c, app))
    .get('/api/tables/:tableId/trash', (c) => handleListTrash(c, app))
    .post('/api/tables/:tableId/records', (c) => handleCreateRecord(c, app))
    .get('/api/tables/:tableId/records/:recordId', (c) => handleGetRecord(c, app))
    .patch('/api/tables/:tableId/records/:recordId', (c) => handleUpdateRecord(c, app))
    .delete('/api/tables/:tableId/records/:recordId', (c) => handleDeleteRecord(c, app))
    .post('/api/tables/:tableId/records/:recordId/restore', (c) => handleRestoreRecord(c, app))
    .post('/api/tables/:tableId/records/:recordId/comments', (c) => handleCreateComment(c, app))
}

/* eslint-enable drizzle/enforce-delete-with-where */
