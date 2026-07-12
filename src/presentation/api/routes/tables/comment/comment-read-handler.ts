/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { markRecordCommentsReadProgram } from '@/application/use-cases/tables/comment-read-state-programs'
import { hasReadPermission } from '@/application/use-cases/tables/permissions/permissions'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { notFoundResponse } from './comment-handler-shared'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

export async function handleMarkCommentsRead(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!

  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)

  if (!table || table.comments?.readTracking !== true) {
    return notFoundResponse(c)
  }

  if (!hasReadPermission(table, userRole, app.tables)) {
    return notFoundResponse(c)
  }

  const result = await runTableProgram(
    markRecordCommentsReadProgram({ session, tableId, recordId, tableName: table.name })
  )

  if (result._tag === 'Left') {
    return notFoundResponse(c)
  }

  return c.json({ success: true }, 200)
}
