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
import { formatValidationError } from '@/presentation/api/validation'
import {
  sanitizeUpdateRichTextFields,
  validateUpdateFieldValues,
  validateUpdateForbiddenFields,
  validateUpdateReadonlyFields,
} from '../record/record-update-guards'
import { filterAllowedFieldsWithRole } from '../record/record-update-handler'
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

async function resolveBulkUpdateFields(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly data: Record<string, unknown>
}): Promise<{ readonly refusal: Response } | { readonly fields: Record<string, unknown> }> {
  const { c, app, tableName, userRole, data } = input

  const readonlyError = validateUpdateReadonlyFields(data, c)
  if (readonlyError) return { refusal: readonlyError }

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    data
  )
  const forbiddenError = validateUpdateForbiddenFields(forbiddenFields, c)
  if (forbiddenError) return { refusal: forbiddenError }

  const valueError = await validateUpdateFieldValues(app, tableName, userRole, allowedData)
  if (valueError) return { refusal: formatValidationError(valueError, c) }

  return { fields: await sanitizeUpdateRichTextFields(app, tableName, userRole, allowedData) }
}

async function resolveBulkUpdateGates(input: {
  readonly c: Context
  readonly app: App
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly userRole: string
  readonly ids: readonly string[]
}): Promise<Response | undefined> {
  const { c, app, session, tableName, userRole, ids } = input

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

  if (ids.length === 0) {
    return c.json({ success: false, message: 'No records specified', code: 'BAD_REQUEST' }, 400)
  }

  if (!guard) return undefined
  return enforceBulkMutationGate({ c, table, session, tableName, ids, guard, op: 'write' })
}

export async function handleFormBulkUpdate(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const body = await c.req.parseBody()
  const ids = parseJsonField<readonly string[]>(body['_ids'], [])
  const data = parseJsonField<Record<string, unknown>>(body['_data'], {})
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  const gateError = await resolveBulkUpdateGates({ c, app, session, tableName, userRole, ids })
  if (gateError) return gateError

  const resolved = await resolveBulkUpdateFields({ c, app, tableName, userRole, data })
  if ('refusal' in resolved) return resolved.refusal

  const recordsData = ids.map((id) => ({ id, fields: resolved.fields }))

  await runTableProgram(
    batchUpdateProgram({ session, tableName, recordsData, returnRecords: false, app })
  )

  if (redirectPath && redirectPath.startsWith('/')) {
    return c.redirect(redirectPath, 302)
  }

  return c.json({ success: true }, 200)
}
