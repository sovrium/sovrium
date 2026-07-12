/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  hasDeletePermission,
  hasUpdatePermission,
} from '@/application/use-cases/tables/permissions/permissions'
import { batchDeleteProgram, batchUpdateProgram } from '@/application/use-cases/tables/programs'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { enforceBulkMutationGate, resolveGuardForTable } from '../record/row-level-guard'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function handleFormBulkDelete(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  if (!guard && !hasDeletePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to delete records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const body = await c.req.parseBody()
  const ids = parseJsonField<readonly string[]>(body['_ids'], [])
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  if (ids.length === 0) {
    return c.json({ success: false, message: 'No records specified', code: 'BAD_REQUEST' }, 400)
  }

  if (guard) {
    const gateError = await enforceBulkMutationGate({
      c,
      table,
      session,
      tableName,
      ids,
      guard,
      op: 'delete',
    })
    if (gateError) return gateError
  }

  await runTableProgram(batchDeleteProgram(session, tableName, ids, false))

  if (redirectPath && redirectPath.startsWith('/')) {
    return c.redirect(redirectPath, 302)
  }

  return c.json({ success: true }, 200)
}

export async function handleFormBulkUpdate(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  if (!guard && !hasUpdatePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to update records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const body = await c.req.parseBody()
  const ids = parseJsonField<readonly string[]>(body['_ids'], [])
  const data = parseJsonField<Record<string, unknown>>(body['_data'], {})
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  if (ids.length === 0) {
    return c.json({ success: false, message: 'No records specified', code: 'BAD_REQUEST' }, 400)
  }

  if (guard) {
    const gateError = await enforceBulkMutationGate({
      c,
      table,
      session,
      tableName,
      ids,
      guard,
      op: 'write',
    })
    if (gateError) return gateError
  }

  const recordsData = ids.map((id) => ({ id, fields: data }))

  await runTableProgram(
    batchUpdateProgram({ session, tableName, recordsData, returnRecords: false, app })
  )

  if (redirectPath && redirectPath.startsWith('/')) {
    return c.redirect(redirectPath, 302)
  }

  return c.json({ success: true }, 200)
}
