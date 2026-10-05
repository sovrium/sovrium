/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getRecordHistoryProgram } from '@/application/use-cases/tables/activity-programs'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext, getTableContext } from '@/presentation/api/runtime/context-helpers'
import { handleRouteError } from './error-handlers'
import { checkRecordReadGate } from './record-read-gate'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Handle get record history request
 */
export async function handleGetRecordHistory(c: Context, app: App) {
  const session = getSessionContext(c)

  // Require authentication
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!

  // Parse pagination query params
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = limitParam !== undefined ? parseInt(limitParam, 10) : undefined
  const offset = offsetParam !== undefined ? parseInt(offsetParam, 10) : undefined

  // Find table by ID OR name, as every records route addresses it
  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
  if (!table) {
    return notFound(c)
  }

  // A history entry IS the record's values: it is gated exactly as a read of
  // the record, so `/history` never shows what `GET /records/:id` would refuse.
  const gateError = await checkRecordReadGate(c, app, table, recordId)
  if (gateError) return gateError

  // Run Effect program
  const program = getRecordHistoryProgram({
    session,
    tableName: table.name,
    recordId,
    limit: Number.isNaN(limit) ? undefined : limit,
    offset: Number.isNaN(offset) ? undefined : offset,
    app,
    userRole: getTableContext(c).userRole,
    userGroups: getTableContext(c).userGroups,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Failure') {
    return handleRouteError(c, result.failure)
  }

  return c.json(result.success, 200)
}
