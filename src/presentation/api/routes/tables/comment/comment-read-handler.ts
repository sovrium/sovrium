/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { markRecordCommentsReadProgram } from '@/application/use-cases/tables/comment-read-state-programs'
import { hasReadPermission } from '@/domain/validators/permission-evaluators'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { notFoundResponse } from './comment-handler-shared'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Handle `POST /api/tables/:tableId/records/:recordId/comments/read`.
 *
 * Marks the record's comments read for the current user. Behind the opt-in
 * `comments.readTracking` flag — the read-state table only exists when a table
 * opts in, so a request against a non-tracking table returns 404 (the feature
 * is inert without opt-in, and this avoids touching a table that was never
 * created).
 *
 * Security (S1 anti-enumeration): the endpoint requires an authenticated
 * session (enforced by the route middleware chain) and returns a uniform 404
 * for a missing/forbidden table, a read-denied role, or a record the caller
 * cannot access — never 403.
 */
export async function handleMarkCommentsRead(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!

  // Find table by ID OR name (validateTable middleware accepts both).
  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)

  // Feature is opt-in: without `comments.readTracking` the read-state table
  // does not exist, so the endpoint is inert → 404 (S1: uniform not-found).
  if (!table || table.comments?.readTracking !== true) {
    return notFoundResponse(c)
  }

  // S1: read-permission denial returns 404 (anti-enumeration), like list.
  if (!hasReadPermission(table, userRole, app.tables)) {
    return notFoundResponse(c)
  }

  const result = await runTableProgram(
    markRecordCommentsReadProgram({ session, tableId, recordId, tableName: table.name })
  )

  if (result._tag === 'Left') {
    // A missing/inaccessible record collapses to 404 (anti-enumeration).
    return notFoundResponse(c)
  }

  return c.json({ success: true }, 200)
}
