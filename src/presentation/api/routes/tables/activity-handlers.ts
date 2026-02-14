/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { getRecordHistoryProgram } from '@/application/use-cases/tables/activity-programs'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
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

  const tableId = c.req.param('tableId')
  const recordId = c.req.param('recordId')

  // Find table by ID
  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Run Effect program
  const program = getRecordHistoryProgram({
    session,
    tableName: table.name,
    recordId,
  }).pipe(Effect.provide(TableLive))

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to fetch activity history', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}
