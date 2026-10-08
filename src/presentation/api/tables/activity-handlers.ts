/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getRecordHistoryProgram } from '@/application/use-cases/tables/activity-programs'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext, getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import { parseCreatedAtSortOrder } from './created-at-sort-param'
import { handleRouteError } from './error-handlers'
import { checkRecordReadGate } from './record-read-gate'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

const intParam = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** `limit` and `offset`, the offset falling back to a one-based `page` of `limit`. */
function parsePagination(c: Context): {
  readonly limit: number | undefined
  readonly offset: number | undefined
} {
  const limit = intParam(c.req.query('limit'))
  const offset = intParam(c.req.query('offset'))
  const page = intParam(c.req.query('page'))
  if (offset !== undefined || page === undefined || limit === undefined || page < 1) {
    return { limit, offset }
  }
  return { limit, offset: (page - 1) * limit }
}

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

  // Parse pagination query params: `offset`, or a one-based `page` read as
  // `(page - 1) × limit` when no offset is given
  const { limit, offset } = parsePagination(c)

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
    limit,
    offset,
    sortOrder: parseCreatedAtSortOrder(c.req.query('sort')),
    app,
    userRole: getTableContext(c).userRole,
    userGroups: getTableContext(c).userGroups,
  })

  const result = await runOnRequest(c, program)

  if (result._tag === 'Failure') {
    return handleRouteError(c, result.failure)
  }

  return c.json(result.success, 200)
}
