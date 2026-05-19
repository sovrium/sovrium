/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getRecordHistoryProgram } from '@/application/use-cases/tables/activity-programs'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { handleRouteError } from './error-handlers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

export async function handleGetRecordHistory(c: Context, app: App) {
  const session = getSessionContext(c)

  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!

  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = limitParam !== undefined ? parseInt(limitParam, 10) : undefined
  const offset = offsetParam !== undefined ? parseInt(offsetParam, 10) : undefined

  const table = app.tables?.find((t) => String(t.id) === String(tableId))
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  const program = getRecordHistoryProgram({
    session,
    tableName: table.name,
    recordId,
    limit: Number.isNaN(limit) ? undefined : limit,
    offset: Number.isNaN(offset) ? undefined : offset,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Left') {
    return handleRouteError(c, result.left)
  }

  return c.json(result.right, 200)
}
